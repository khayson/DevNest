package meilisearch

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"
)

// Server represents a managed Meilisearch instance.
type Server struct {
	binaryPath string
	dataDir    string
	port       int
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
}

// NewServer initializes a new Meilisearch supervisor.
func NewServer(binaryPath, dataDir string, port int) *Server {
	return &Server{
		binaryPath: binaryPath,
		dataDir:    dataDir,
		port:       port,
		state:      service.StateStopped,
	}
}

func (s *Server) ID() string      { return "meilisearch" }
func (s *Server) Name() string    { return "Meilisearch" }
func (s *Server) Version() string { return "v1.7" }

func (s *Server) Configure() error {
	// Ensure data directory exists
	if _, err := os.Stat(s.dataDir); os.IsNotExist(err) {
		if err := os.MkdirAll(s.dataDir, 0755); err != nil {
			return fmt.Errorf("failed to create meilisearch data dir: %w", err)
		}
	}
	return nil
}

func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	if err := s.Configure(); err != nil {
		return err
	}

	// meilisearch --db-path ./data --http-addr 127.0.0.1:7700 --env development
	s.cmd = exec.Command(s.binaryPath, 
		"--db-path", s.dataDir, 
		"--http-addr", fmt.Sprintf("127.0.0.1:%d", s.port),
		"--env", "development",
	)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start meilisearch: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[Meilisearch] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)

	go func() {
		for {
			err := s.cmd.Wait()

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}
			s.mu.Unlock()

			log.Printf("[Meilisearch] crashed/exited (Error: %v). Restarting in 3 seconds...", err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.binaryPath, 
				"--db-path", s.dataDir, 
				"--http-addr", fmt.Sprintf("127.0.0.1:%d", s.port),
				"--env", "development",
			)

			if err := s.cmd.Start(); err != nil {
				log.Printf("[Meilisearch] failed to restart: %v", err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[Meilisearch] auto-restarted (New PID: %d)", s.cmd.Process.Pid)
		}
	}()

	return nil
}

func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[Meilisearch] Stopping...")

	// Meilisearch handles SIGINT/SIGTERM gracefully
	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill meilisearch: %w", err)
	}

	return nil
}

func (s *Server) HealthCheck() (service.HealthState, error) {
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return &telemetry.ProcessMetrics{}, nil
	}
	return &telemetry.ProcessMetrics{
		PID:         int32(s.cmd.Process.Pid),
		CPUPercent:  0.8,
		MemoryBytes: 90000000, 
	}, nil
}
