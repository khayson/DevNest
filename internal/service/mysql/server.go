package mysql

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

// Server represents a managed MySQL/MariaDB process.
type Server struct {
	binaryPath string
	dataDir    string
	port       int
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
}

// NewServer initializes a new MySQL service manager.
func NewServer(binaryPath string, port int) *Server {
	homeDir, _ := os.UserHomeDir()
	return &Server{
		binaryPath: binaryPath,
		dataDir:    filepath.Join(homeDir, ".devnest", "data", "mysql"),
		port:       port,
		state:      service.StateStopped,
	}
}

func (s *Server) ID() string      { return "mysql" }
func (s *Server) Name() string    { return "MySQL Server" }
func (s *Server) Version() string { return "8.0" }

// Configure ensures the data directory exists and initializes MySQL if needed.
func (s *Server) Configure() error {
	if err := os.MkdirAll(s.dataDir, 0700); err != nil {
		return fmt.Errorf("failed to create MySQL data dir: %w", err)
	}

	// Check if data directory is already initialized
	ibdata := filepath.Join(s.dataDir, "ibdata1")
	if _, err := os.Stat(ibdata); os.IsNotExist(err) {
		log.Printf("[MySQL] Initializing data directory at %s", s.dataDir)
		initCmd := exec.Command(s.binaryPath,
			"--initialize-insecure",
			"--datadir="+s.dataDir,
		)
		output, err := initCmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("MySQL init failed: %s, output: %s", err, string(output))
		}
		log.Printf("[MySQL] Data directory initialized successfully")
	}

	return nil
}

// Start launches the mysqld process.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.cmd = exec.Command(s.binaryPath,
		"--datadir="+s.dataDir,
		fmt.Sprintf("--port=%d", s.port),
		"--bind-address=127.0.0.1",
		"--skip-grant-tables",      // Dev-friendly: no auth required locally
		"--innodb-flush-method=normal",
		"--innodb-buffer-pool-size=128M",
		"--max-connections=50",
		"--skip-networking=OFF",
	)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start MySQL: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[MySQL] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)

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

			log.Printf("[MySQL] Crashed (Error: %v). Restarting in 3 seconds...", err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.binaryPath,
				"--datadir="+s.dataDir,
				fmt.Sprintf("--port=%d", s.port),
				"--bind-address=127.0.0.1",
				"--skip-grant-tables",
				"--innodb-flush-method=normal",
				"--innodb-buffer-pool-size=128M",
				"--max-connections=50",
			)

			if err := s.cmd.Start(); err != nil {
				log.Printf("[MySQL] Failed to restart: %v", err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[MySQL] Auto-restarted (New PID: %d)", s.cmd.Process.Pid)
		}
	}()

	return nil
}

// Stop gracefully shuts down MySQL.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[MySQL] Stopping...")

	// Try graceful shutdown via mysqladmin
	adminPath := filepath.Join(filepath.Dir(s.binaryPath), "mysqladmin")
	shutdownCmd := exec.Command(adminPath, "-u", "root", fmt.Sprintf("--port=%d", s.port), "shutdown")
	if err := shutdownCmd.Run(); err == nil {
		log.Printf("[MySQL] Graceful shutdown successful")
		return nil
	}

	// Fallback: kill
	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill MySQL process: %w", err)
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
		CPUPercent:  0.5,
		MemoryBytes: 134217728, // ~128MB default
	}, nil
}
