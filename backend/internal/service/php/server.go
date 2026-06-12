package php

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os/exec"
	"sync"
	"time"
)

// Server represents a managed PHP CGI or FPM process.
type Server struct {
	id         string
	version    string
	binaryPath string
	port       int
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
}

// NewServer initializes a new PHP CGI process manager.
func NewServer(id, version, cgiPath string, port int) *Server {
	return &Server{
		id:         id,
		version:    version,
		binaryPath: cgiPath,
		port:       port,
		state:      service.StateStopped,
	}
}

func (s *Server) ID() string      { return s.id }
func (s *Server) Name() string    { return fmt.Sprintf("PHP %s", s.version) }
func (s *Server) Version() string { return s.version }
func (s *Server) Port() int       { return s.port }

// Configure could generate php.ini settings specifically for this project/environment.
func (s *Server) Configure() error {
	return nil
}

// Start launches the php-cgi process bound to a specific port.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.cmd = exec.Command(s.binaryPath, "-b", fmt.Sprintf("127.0.0.1:%d", s.port))
	s.cmd.Env = append(s.cmd.Environ(), "PHP_FCGI_CHILDREN=4", "PHP_FCGI_MAX_REQUESTS=10000")

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start php process %s: %w", s.version, err)
	}

	s.state = service.StateRunning
	log.Printf("[PHP] Started %s (PID: %d) on port %d", s.id, s.cmd.Process.Pid, s.port)

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

			log.Printf("[PHP] %s crashed or exited (Error: %v). Restarting in 3 seconds...", s.id, err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			// Check again after the sleep in case Stop() was called during the wait
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			// Re-create the command since exec.Cmd cannot be reused
			s.cmd = exec.Command(s.binaryPath, "-b", fmt.Sprintf("127.0.0.1:%d", s.port))
			s.cmd.Env = append(s.cmd.Environ(), "PHP_FCGI_CHILDREN=4", "PHP_FCGI_MAX_REQUESTS=10000")

			if err := s.cmd.Start(); err != nil {
				log.Printf("[PHP] %s failed to restart: %v", s.id, err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[PHP] %s auto-restarted (New PID: %d)", s.id, s.cmd.Process.Pid)
		}
	}()

	return nil
}

// Stop gracefully stops the PHP process and prevents the supervisor from restarting it.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	// CRITICAL: Set state BEFORE killing so the supervisor loop exits cleanly.
	s.state = service.StateStopped
	log.Printf("[PHP] Stopping %s", s.id)

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill php process: %w", err)
	}

	return nil
}

// HealthCheck verifies if the PHP process is active.
func (s *Server) HealthCheck() (service.HealthState, error) {
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return &telemetry.ProcessMetrics{}, nil
	}

	return &telemetry.ProcessMetrics{
		PID: int32(s.cmd.Process.Pid),
	}, nil
}
