package redis

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Server represents a managed Redis process.
type Server struct {
	binaryPath string
	dataDir    string
	port       int
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
}

// NewServer initializes a new Redis service manager.
func NewServer(binaryPath string, port int) *Server {
	homeDir, _ := os.UserHomeDir()
	return &Server{
		binaryPath: binaryPath,
		dataDir:    filepath.Join(homeDir, ".devnest", "data", "redis"),
		port:       port,
		state:      service.StateStopped,
	}
}

func (s *Server) ID() string      { return "redis" }
func (s *Server) Name() string    { return "Redis Server" }
func (s *Server) Version() string { return "7.0" }

// Configure ensures the data directory exists.
func (s *Server) Configure() error {
	return os.MkdirAll(s.dataDir, 0700)
}

// Start launches the redis-server process.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.cmd = exec.Command(s.binaryPath,
		"--port", fmt.Sprintf("%d", s.port),
		"--bind", "127.0.0.1",
		"--dir", s.dataDir,
		"--save", "60", "1000",          // Snapshot every 60s if 1000+ writes
		"--maxmemory", "64mb",
		"--maxmemory-policy", "allkeys-lru",
		"--daemonize", "no",             // Run in foreground for supervisor
		"--loglevel", "notice",
		"--protected-mode", "no",        // Dev-friendly: no auth locally
	)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start Redis: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[Redis] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)

	// Auto-healing supervisor loop
	go func() {
		for {
			err := s.cmd.Wait()

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}
			s.mu.Unlock()

			log.Printf("[Redis] Crashed (Error: %v). Restarting in 2 seconds...", err)
			time.Sleep(2 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.binaryPath,
				"--port", fmt.Sprintf("%d", s.port),
				"--bind", "127.0.0.1",
				"--dir", s.dataDir,
				"--save", "60", "1000",
				"--maxmemory", "64mb",
				"--maxmemory-policy", "allkeys-lru",
				"--daemonize", "no",
				"--loglevel", "notice",
				"--protected-mode", "no",
			)

			if err := s.cmd.Start(); err != nil {
				log.Printf("[Redis] Failed to restart: %v", err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[Redis] Auto-restarted (New PID: %d)", s.cmd.Process.Pid)
		}
	}()

	return nil
}

// Stop gracefully shuts down Redis.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[Redis] Stopping...")

	// Try graceful shutdown via redis-cli
	cliPath := filepath.Join(filepath.Dir(s.binaryPath), "redis-cli")
	shutdownCmd := exec.Command(cliPath, "-p", fmt.Sprintf("%d", s.port), "shutdown", "save")
	if err := shutdownCmd.Run(); err == nil {
		log.Printf("[Redis] Graceful shutdown with SAVE successful")
		return nil
	}

	// Fallback: kill
	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill Redis process: %w", err)
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
		CPUPercent:  0.2,
		MemoryBytes: 16777216, // ~16MB typical
	}, nil
}
