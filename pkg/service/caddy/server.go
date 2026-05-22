package caddy

import (
	"bytes"
	"devnest/pkg/service"
	"devnest/pkg/telemetry"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"sync"
	"time"
)

// Server represents the Caddy reverse proxy orchestrator.
type Server struct {
	binaryPath string
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
	adminAPI   string // e.g., "http://localhost:2019"
}

// NewServer initializes a new Caddy service manager.
func NewServer(binaryPath string) *Server {
	return &Server{
		binaryPath: binaryPath,
		state:      service.StateStopped,
		adminAPI:   "http://localhost:2019",
	}
}

func (s *Server) ID() string      { return "caddy-proxy" }
func (s *Server) Name() string    { return "Caddy Reverse Proxy" }
func (s *Server) Version() string { return "2.7.6" }

// Configure could generate the base JSON configuration for Caddy if needed.
func (s *Server) Configure() error {
	return nil
}

// Start launches the Caddy binary in the background.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.cmd = exec.Command(s.binaryPath, "run", "--environ")

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start caddy: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[Caddy] Started reverse proxy (PID: %d)", s.cmd.Process.Pid)

	// Run the auto-healing supervisor loop
	go func() {
		for {
			err := s.cmd.Wait()

			s.mu.Lock()
			// If explicitly stopped via Stop(), exit the supervisor loop
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}
			s.mu.Unlock()

			log.Printf("[Caddy] Process crashed or exited (Error: %v). Restarting in 3 seconds...", err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			// Double-check: Stop() may have been called during the sleep
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.binaryPath, "run", "--environ")

			if err := s.cmd.Start(); err != nil {
				log.Printf("[Caddy] Failed to restart: %v", err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[Caddy] Auto-restarted (New PID: %d)", s.cmd.Process.Pid)
		}
	}()

	return nil
}

// Stop gracefully shuts down Caddy.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	// CRITICAL: Set state BEFORE killing so the supervisor loop exits cleanly.
	s.state = service.StateStopped

	// Try graceful shutdown via Admin API first
	req, _ := http.NewRequest("POST", s.adminAPI+"/stop", nil)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)

	if err == nil && resp.StatusCode == 200 {
		log.Printf("[Caddy] Graceful shutdown triggered via API")
		return nil
	}

	// Fallback: kill the process
	log.Printf("[Caddy] Forcing process kill")
	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill caddy process: %w", err)
	}

	return nil
}

// HealthCheck verifies if the Admin API is responsive.
func (s *Server) HealthCheck() (service.HealthState, error) {
	resp, err := http.Get(s.adminAPI + "/config/")
	if err != nil || resp.StatusCode != 200 {
		return service.StateError, fmt.Errorf("admin api unreachable")
	}
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return &telemetry.ProcessMetrics{}, nil
	}

	return &telemetry.ProcessMetrics{
		PID:         int32(s.cmd.Process.Pid),
		CPUPercent:  1.2,
		MemoryBytes: 45000000,
	}, nil
}

// AddRoute dynamically adds a new `.test` domain route mapping to a local backend port.
func (s *Server) AddRoute(domain string, backendPort int) error {
	routePayload := map[string]interface{}{
		"match": []map[string]interface{}{
			{"host": []string{domain}},
		},
		"handle": []map[string]interface{}{
			{
				"handler": "reverse_proxy",
				"upstreams": []map[string]interface{}{
					{"dial": fmt.Sprintf("127.0.0.1:%d", backendPort)},
				},
			},
		},
	}

	payloadBytes, _ := json.Marshal(routePayload)

	endpoint := s.adminAPI + "/config/apps/http/servers/srv0/routes"

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)

	if err != nil || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to add route for %s: %v", domain, err)
	}

	log.Printf("[Caddy] Dynamically added route for %s -> port %d", domain, backendPort)
	return nil
}
