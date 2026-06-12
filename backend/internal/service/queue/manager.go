package queue

import (
	"devnest/internal/config"
	"devnest/internal/service"
	"devnest/internal/service/sites"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"sync"
)

// WorkerOptions configures artisan queue:work flags.
type WorkerOptions struct {
	Tries      int
	Timeout    int
	Memory     int
	Queues     string
	Connection string
}

// Manager supervises per-site Laravel queue workers.
type Manager struct {
	mu         sync.Mutex
	workers    map[string]*Server
	registerFn func(service.Service)
	unregister func(string)
}

func NewManager(register func(service.Service), unregister func(string)) *Manager {
	return &Manager{
		workers:    make(map[string]*Server),
		registerFn: register,
		unregister: unregister,
	}
}

// ServiceID returns the daemon service id for a site domain.
func ServiceID(domain string) string {
	return "queue-" + sanitizeDomain(domain)
}

func sanitizeDomain(domain string) string {
	r := strings.NewReplacer(".", "-", ":", "-", "/", "-")
	return r.Replace(domain)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return "default"
}

// SyncWorkers ensures worker entries exist for Laravel sites (does not auto-start).
func (m *Manager) SyncWorkers(siteList []config.SiteEntry, phpForSite func(config.SiteEntry) (string, bool), defaults config.QueueWorkerDefaults) {
	m.mu.Lock()
	defer m.mu.Unlock()

	active := map[string]bool{}
	for _, site := range siteList {
		if sites.DetectType(site.Path) != sites.TypeLaravel {
			continue
		}
		active[site.Domain] = true
		env := ReadEnvInfo(site.Path)
		phpBin, ok := phpForSite(site)
		if !ok {
			continue
		}
		opts := WorkerOptions{
			Tries:      defaults.Tries,
			Timeout:    defaults.Timeout,
			Memory:     defaults.Memory,
			Queues:     firstNonEmpty(defaults.Queues, env.Queues),
			Connection: env.Connection,
		}
		id := ServiceID(site.Domain)
		if existing, ok := m.workers[site.Domain]; ok {
			existing.UpdateOptions(phpBin, site.Path, opts)
			continue
		}
		srv := NewServer(id, site.Domain, phpBin, site.Path, opts)
		m.workers[site.Domain] = srv
		if m.registerFn != nil {
			m.registerFn(srv)
		}
	}

	for domain, srv := range m.workers {
		if active[domain] {
			continue
		}
		_ = srv.Stop()
		if m.unregister != nil {
			m.unregister(srv.ID())
		}
		delete(m.workers, domain)
	}
}

// Start launches the worker for a domain.
func (m *Manager) Start(domain string) error {
	m.mu.Lock()
	srv, ok := m.workers[domain]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("queue worker not found for %s", domain)
	}
	if !SupportsWorker(srv.Connection()) {
		return fmt.Errorf("queue connection %q does not support workers (sync driver)", srv.Connection())
	}
	return srv.Start()
}

// Stop stops the worker for a domain.
func (m *Manager) Stop(domain string) error {
	m.mu.Lock()
	srv, ok := m.workers[domain]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("queue worker not found for %s", domain)
	}
	return srv.Stop()
}

// Restart stops and starts the worker for a domain.
func (m *Manager) Restart(domain string) error {
	if err := m.Stop(domain); err != nil {
		log.Printf("[Queue] restart stop warning for %s: %v", domain, err)
	}
	return m.Start(domain)
}

// ApplyDefaults updates options on all workers and restarts running ones.
func (m *Manager) ApplyDefaults(defaults config.QueueWorkerDefaults) {
	m.mu.Lock()
	var restart []string
	for domain, srv := range m.workers {
		env := ReadEnvInfo(srv.ProjectPath())
		opts := WorkerOptions{
			Tries:      defaults.Tries,
			Timeout:    defaults.Timeout,
			Memory:     defaults.Memory,
			Queues:     firstNonEmpty(defaults.Queues, env.Queues),
			Connection: env.Connection,
		}
		srv.UpdateOptions(srv.PHPBinary(), srv.ProjectPath(), opts)
		state, _ := srv.HealthCheck()
		if state == service.StateRunning {
			restart = append(restart, domain)
		}
	}
	m.mu.Unlock()

	for _, domain := range restart {
		if err := m.Restart(domain); err != nil {
			log.Printf("[Queue] failed to restart %s after config change: %v", domain, err)
		}
	}
}

// WorkerView is the UI payload for a queue worker row.
type WorkerView struct {
	Domain       string `json:"domain"`
	SiteName     string `json:"site_name"`
	Connection   string `json:"connection"`
	Queues       string `json:"queues"`
	ServiceID    string `json:"service_id"`
	SupportsWork bool   `json:"supports_worker"`
	LogPath      string `json:"log_path"`
}

// ListWorkers builds sync rows for Laravel sites.
func (m *Manager) ListWorkers(siteList []config.SiteEntry) []WorkerView {
	m.mu.Lock()
	defer m.mu.Unlock()

	var out []WorkerView
	for _, site := range siteList {
		if sites.DetectType(site.Path) != sites.TypeLaravel {
			continue
		}
		env := ReadEnvInfo(site.Path)
		name := site.Name
		if name == "" {
			name = site.Domain
		}
		out = append(out, WorkerView{
			Domain:       site.Domain,
			SiteName:     name,
			Connection:   env.Connection,
			Queues:       firstNonEmpty(env.Queues, "default"),
			ServiceID:    ServiceID(site.Domain),
			SupportsWork: SupportsWorker(env.Connection),
			LogPath:      filepath.Join(site.Path, "storage", "logs", "laravel.log"),
		})
	}
	return out
}
