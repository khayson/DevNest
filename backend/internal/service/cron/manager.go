package cron

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

// Manager supervises per-site Laravel schedule:work processes.
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
	return "cron-" + sanitizeDomain(domain)
}

func sanitizeDomain(domain string) string {
	r := strings.NewReplacer(".", "-", ":", "-", "/", "-")
	return r.Replace(domain)
}

// SyncSchedulers ensures scheduler entries exist for Laravel sites.
func (m *Manager) SyncSchedulers(siteList []config.SiteEntry, phpForSite func(config.SiteEntry) (string, bool)) {
	m.mu.Lock()
	defer m.mu.Unlock()

	active := map[string]bool{}
	for _, site := range siteList {
		if sites.DetectType(site.Path) != sites.TypeLaravel {
			continue
		}
		active[site.Domain] = true
		phpBin, ok := phpForSite(site)
		if !ok {
			continue
		}
		id := ServiceID(site.Domain)
		if existing, ok := m.workers[site.Domain]; ok {
			existing.UpdatePHP(phpBin, site.Path)
			continue
		}
		srv := NewServer(id, site.Domain, phpBin, site.Path)
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

func (m *Manager) Start(domain string) error {
	m.mu.Lock()
	srv, ok := m.workers[domain]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("scheduler not found for %s", domain)
	}
	return srv.Start()
}

func (m *Manager) Stop(domain string) error {
	m.mu.Lock()
	srv, ok := m.workers[domain]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("scheduler not found for %s", domain)
	}
	return srv.Stop()
}

func (m *Manager) Restart(domain string) error {
	if err := m.Stop(domain); err != nil {
		log.Printf("[Cron] restart stop warning for %s: %v", domain, err)
	}
	return m.Start(domain)
}

// RunOnce executes php artisan schedule:run for a site.
func (m *Manager) RunOnce(domain string) (string, error) {
	m.mu.Lock()
	srv, ok := m.workers[domain]
	m.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("scheduler not found for %s", domain)
	}
	return srv.RunScheduleOnce()
}

// SchedulerView is the UI payload for a scheduler row.
type SchedulerView struct {
	Domain     string `json:"domain"`
	SiteName   string `json:"site_name"`
	Command    string `json:"command"`
	Frequency  string `json:"frequency"`
	ServiceID  string `json:"service_id"`
	LogPath    string `json:"log_path"`
}

// ListSchedulers builds sync rows for Laravel sites.
func (m *Manager) ListSchedulers(siteList []config.SiteEntry) []SchedulerView {
	var out []SchedulerView
	for _, site := range siteList {
		if sites.DetectType(site.Path) != sites.TypeLaravel {
			continue
		}
		name := site.Name
		if name == "" {
			name = site.Domain
		}
		out = append(out, SchedulerView{
			Domain:    site.Domain,
			SiteName:  name,
			Command:   "php artisan schedule:work",
			Frequency: "Continuous (schedule:work)",
			ServiceID: ServiceID(site.Domain),
			LogPath:   filepath.Join(site.Path, "storage", "logs", "laravel.log"),
		})
	}
	return out
}
