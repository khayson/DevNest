package postgres

import (
	"devnest/pkg/service"
	"devnest/pkg/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Server represents a managed PostgreSQL process.
type Server struct {
	binaryPath string
	dataDir    string
	port       int
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
}

// NewServer initializes a new PostgreSQL service manager.
func NewServer(binaryPath string, port int) *Server {
	homeDir, _ := os.UserHomeDir()
	return &Server{
		binaryPath: binaryPath,
		dataDir:    filepath.Join(homeDir, ".devnest", "data", "postgres"),
		port:       port,
		state:      service.StateStopped,
	}
}

func (s *Server) ID() string      { return "postgresql" }
func (s *Server) Name() string    { return "PostgreSQL Server" }
func (s *Server) Version() string { return "16" }

// Configure ensures the data directory exists and runs initdb if needed.
func (s *Server) Configure() error {
	if err := os.MkdirAll(s.dataDir, 0700); err != nil {
		return fmt.Errorf("failed to create PostgreSQL data dir: %w", err)
	}

	// Check if already initialized
	pgVersion := filepath.Join(s.dataDir, "PG_VERSION")
	if _, err := os.Stat(pgVersion); os.IsNotExist(err) {
		log.Printf("[PostgreSQL] Initializing data directory at %s", s.dataDir)
		initdbPath := filepath.Join(filepath.Dir(s.binaryPath), "initdb")
		initCmd := exec.Command(initdbPath,
			"-D", s.dataDir,
			"-U", "devnest",
			"--auth=trust",
			"--encoding=UTF8",
		)
		output, err := initCmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("PostgreSQL initdb failed: %s, output: %s", err, string(output))
		}
		log.Printf("[PostgreSQL] Data directory initialized successfully")
	}

	return nil
}

// Start launches the postgres process.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.cmd = exec.Command(s.binaryPath,
		"-D", s.dataDir,
		"-p", fmt.Sprintf("%d", s.port),
		"-h", "127.0.0.1",
		"-k", "", // Disable Unix sockets on Windows
	)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start PostgreSQL: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[PostgreSQL] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)

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

			log.Printf("[PostgreSQL] Crashed (Error: %v). Restarting in 3 seconds...", err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.binaryPath,
				"-D", s.dataDir,
				"-p", fmt.Sprintf("%d", s.port),
				"-h", "127.0.0.1",
				"-k", "",
			)

			if err := s.cmd.Start(); err != nil {
				log.Printf("[PostgreSQL] Failed to restart: %v", err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[PostgreSQL] Auto-restarted (New PID: %d)", s.cmd.Process.Pid)
		}
	}()

	return nil
}

// Stop gracefully shuts down PostgreSQL.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[PostgreSQL] Stopping...")

	// Try graceful shutdown via pg_ctl
	pgCtlPath := filepath.Join(filepath.Dir(s.binaryPath), "pg_ctl")
	shutdownCmd := exec.Command(pgCtlPath, "stop", "-D", s.dataDir, "-m", "fast")
	if err := shutdownCmd.Run(); err == nil {
		log.Printf("[PostgreSQL] Graceful shutdown successful")
		return nil
	}

	// Fallback: kill
	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill PostgreSQL process: %w", err)
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
		CPUPercent:  0.4,
		MemoryBytes: 67108864, // ~64MB default
	}, nil
}
