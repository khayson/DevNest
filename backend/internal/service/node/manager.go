package node

import (
	"devnest/internal/config"
	"devnest/internal/service"
	"fmt"
	"log"
	"strings"
	"sync"
)

// Manager supervises per-site npm run dev processes.
type Manager struct {
	mu         sync.Mutex
	servers    map[string]*Server
	registerFn func(service.Service)
	unregister func(string)
}

func NewManager(register func(service.Service), unregister func(string)) *Manager {
	return &Manager{
		servers:    make(map[string]*Server),
		registerFn: register,
		unregister: unregister,
	}
}

func ServiceID(domain string) string {
	return "node-" + sanitizeDomain(domain)
}

func sanitizeDomain(domain string) string {
	r := strings.NewReplacer(".", "-", ":", "-", "/", "-")
	return r.Replace(domain)
}

// SyncServers registers node dev servers for sites with package.json dev scripts.
func (m *Manager) SyncServers(siteList []config.SiteEntry, inst Installation) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if inst.Binary == "" {
		return
	}

	active := map[string]bool{}
	for _, site := range siteList {
		if !IsNodeProject(site.Path) {
			continue
		}
		active[site.Domain] = true
		port := site.Port
		if port <= 0 {
			port = 5173
		}
		id := ServiceID(site.Domain)
		if existing, ok := m.servers[site.Domain]; ok {
			existing.Update(inst, site.Path, port)
			continue
		}
		srv := NewServer(id, site.Domain, inst, site.Path, port)
		m.servers[site.Domain] = srv
		if m.registerFn != nil {
			m.registerFn(srv)
		}
	}

	for domain, srv := range m.servers {
		if active[domain] {
			continue
		}
		_ = srv.Stop()
		if m.unregister != nil {
			m.unregister(srv.ID())
		}
		delete(m.servers, domain)
	}
}

func (m *Manager) Start(domain string) error {
	m.mu.Lock()
	srv, ok := m.servers[domain]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("node dev server not found for %s", domain)
	}
	return srv.Start()
}

func (m *Manager) Stop(domain string) error {
	m.mu.Lock()
	srv, ok := m.servers[domain]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("node dev server not found for %s", domain)
	}
	return srv.Stop()
}

func (m *Manager) Restart(domain string) error {
	if err := m.Stop(domain); err != nil {
		log.Printf("[Node] restart stop warning for %s: %v", domain, err)
	}
	return m.Start(domain)
}

// DevServerView is the UI row for a node project.
type DevServerView struct {
	Domain      string      `json:"domain"`
	SiteName    string      `json:"site_name"`
	Port        int         `json:"port"`
	ServiceID   string      `json:"service_id"`
	DevCommand  string      `json:"dev_command"`
	UsesVite    bool        `json:"uses_vite"`
	ProjectInfo ProjectInfo `json:"project_info"`
}

func (m *Manager) ListServers(siteList []config.SiteEntry) []DevServerView {
	var out []DevServerView
	for _, site := range siteList {
		info := InspectProject(site.Path)
		if !info.HasDevScript {
			continue
		}
		name := site.Name
		if name == "" {
			name = site.Domain
		}
		port := site.Port
		if port <= 0 {
			port = 5173
		}
		out = append(out, DevServerView{
			Domain:      site.Domain,
			SiteName:    name,
			Port:        port,
			ServiceID:   ServiceID(site.Domain),
			DevCommand:  info.DevCommand,
			UsesVite:    info.UsesVite,
			ProjectInfo: info,
		})
	}
	return out
}

func (m *Manager) ApplyInstallation(inst Installation) {
	m.mu.Lock()
	for _, srv := range m.servers {
		wasRunning := false
		state, _ := srv.HealthCheck()
		wasRunning = state == service.StateRunning
		srv.Update(inst, srv.ProjectPath(), srv.Port())
		if wasRunning {
			_ = srv.Stop()
			_ = srv.Start()
		}
	}
	m.mu.Unlock()
}
