package php

import (
	"devnest/internal/service"
	"fmt"
	"log"
	"sync"
)

// Pool manages php-cgi processes keyed by full version string.
type Pool struct {
	mu         sync.Mutex
	servers    map[string]*Server
	primary    *Server
	basePort   int
	nextPort   int
	registerFn func(*Server)
}

func NewPool(basePort int, register func(*Server)) *Pool {
	return &Pool{
		servers:    make(map[string]*Server),
		basePort:   basePort,
		nextPort:   basePort + 1,
		registerFn: register,
	}
}

// Primary returns the global active php-cgi process.
func (p *Pool) Primary() *Server {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.primary
}

// PortFor returns the FastCGI port for a version, or 0 if unknown.
func (p *Pool) PortFor(version string) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	if srv, ok := p.servers[version]; ok {
		return srv.Port()
	}
	return 0
}

// EnsurePrimary registers the global php-cgi on the base port (id: php-cgi).
func (p *Pool) EnsurePrimary(inst Installation, autostart bool) (*Server, error) {
	p.mu.Lock()
	if srv, ok := p.servers[inst.Version]; ok && p.primary == srv {
		p.mu.Unlock()
		if autostart {
			_ = srv.Configure()
			if err := srv.Start(); err != nil {
				log.Printf("[PHP Pool] Failed to start primary %s: %v", inst.Version, err)
			}
		}
		return srv, nil
	}

	if p.primary != nil {
		_ = p.primary.Stop()
		delete(p.servers, p.primary.Version())
	}

	srv := NewServer("php-cgi", inst.Version, inst.CGIPath, p.basePort)
	p.servers[inst.Version] = srv
	p.primary = srv
	if p.registerFn != nil {
		p.registerFn(srv)
	}
	p.mu.Unlock()

	log.Printf("[PHP Pool] Primary PHP %s on port %d", inst.Label, p.basePort)
	if autostart {
		if err := srv.Configure(); err != nil {
			return srv, err
		}
		if err := srv.Start(); err != nil {
			return srv, err
		}
	}
	return srv, nil
}

// EnsurePinned registers an additional php-cgi for a site-specific version.
func (p *Pool) EnsurePinned(inst Installation, autostart bool) (int, error) {
	p.mu.Lock()
	if srv, ok := p.servers[inst.Version]; ok {
		port := srv.Port()
		p.mu.Unlock()
		if autostart {
			_ = srv.Configure()
			if err := srv.Start(); err != nil {
				log.Printf("[PHP Pool] Failed to start pinned %s: %v", inst.Version, err)
			}
		}
		return port, nil
	}

	port := p.nextPort
	p.nextPort++
	id := fmt.Sprintf("php-cgi-%s", inst.Version)
	srv := NewServer(id, inst.Version, inst.CGIPath, port)
	p.servers[inst.Version] = srv
	if p.registerFn != nil {
		p.registerFn(srv)
	}
	p.mu.Unlock()

	log.Printf("[PHP Pool] Pinned PHP %s on port %d", inst.Label, port)
	if autostart {
		if err := srv.Configure(); err != nil {
			return port, err
		}
		if err := srv.Start(); err != nil {
			return port, err
		}
	}
	return port, nil
}

// RunningCount returns how many pooled processes are running.
func (p *Pool) RunningCount() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	count := 0
	for _, srv := range p.servers {
		state, _ := srv.HealthCheck()
		if state == service.StateRunning {
			count++
		}
	}
	return count
}
