package service

import (
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"sync"
)

// Manager coordinates all background services.
type Manager struct {
	mu       sync.RWMutex
	services map[string]Service
}

// NewManager creates a new empty service manager.
func NewManager() *Manager {
	return &Manager{
		services: make(map[string]Service),
	}
}

// Register adds a service to the manager. It does not start it automatically.
func (m *Manager) Register(srv Service) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.services[srv.ID()] = srv
	log.Printf("[Manager] Registered service: %s (%s)", srv.Name(), srv.Version())
}

// StartAll starts all registered services.
func (m *Manager) StartAll() error {
	m.mu.RLock()
	// Create a copy of the slice to avoid holding the lock during starts
	var svcs []Service
	for _, s := range m.services {
		svcs = append(svcs, s)
	}
	m.mu.RUnlock()

	for _, s := range svcs {
		if err := s.Configure(); err != nil {
			return fmt.Errorf("failed to configure %s: %w", s.ID(), err)
		}
		if err := s.Start(); err != nil {
			return fmt.Errorf("failed to start %s: %w", s.ID(), err)
		}
	}
	return nil
}

// StopAll stops all registered services gracefully.
func (m *Manager) StopAll() {
	m.mu.RLock()
	var svcs []Service
	for _, s := range m.services {
		svcs = append(svcs, s)
	}
	m.mu.RUnlock()

	var wg sync.WaitGroup
	for _, s := range svcs {
		wg.Add(1)
		go func(srv Service) {
			defer wg.Done()
			if err := srv.Stop(); err != nil {
				log.Printf("[Manager] Error stopping %s: %v", srv.ID(), err)
			}
		}(s)
	}
	wg.Wait()
	log.Printf("[Manager] All services stopped.")
}

// GetService returns a specific service by ID.
func (m *Manager) GetService(id string) (Service, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.services[id]
	return s, ok
}

// GetAllMetrics collects telemetry from all running services.
func (m *Manager) GetAllMetrics() map[string]*telemetry.ProcessMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metrics := make(map[string]*telemetry.ProcessMetrics)
	for id, s := range m.services {
		m, err := s.GetMetrics()
		if err == nil && m != nil {
			metrics[id] = m
		}
	}
	return metrics
}

// HealthCheck checks the health of all services.
func (m *Manager) HealthCheck() map[string]HealthState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	health := make(map[string]HealthState)
	for id, s := range m.services {
		state, _ := s.HealthCheck()
		health[id] = state
	}
	return health
}
