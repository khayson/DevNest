package postgres

import (
	"devnest/internal/service"
	"devnest/internal/service/database"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const maxRestartAttempts = 3

// Server represents a managed PostgreSQL process.
type Server struct {
	binaryPath   string
	dataDir      string
	port         int
	versionLabel string
	cmd          *exec.Cmd
	state        service.HealthState
	externalMode bool
	mu           sync.Mutex
}

// NewServer initializes a new PostgreSQL service manager.
func NewServer(binaryPath string, port int) *Server {
	homeDir, _ := os.UserHomeDir()
	return &Server{
		binaryPath:   binaryPath,
		dataDir:      filepath.Join(homeDir, ".devnest", "data", "postgres"),
		port:         port,
		versionLabel: database.PostgresVersionLabel(binaryPath),
		state:        service.StateStopped,
	}
}

func (s *Server) ID() string      { return "postgres" }
func (s *Server) Name() string    { return "PostgreSQL Server" }
func (s *Server) Version() string { return s.versionLabel }

func (s *Server) toolPath(name string) string {
	p := filepath.Join(filepath.Dir(s.binaryPath), name)
	if runtime.GOOS == "windows" {
		p += ".exe"
	}
	return p
}

// Configure ensures the data directory exists and runs initdb if needed.
func (s *Server) Configure() error {
	if database.IsExternalPostgresBinary(s.binaryPath) && database.PortInUse("127.0.0.1", s.port) {
		return nil
	}

	if err := os.MkdirAll(s.dataDir, 0700); err != nil {
		return fmt.Errorf("failed to create PostgreSQL data dir: %w", err)
	}

	pgVersion := filepath.Join(s.dataDir, "PG_VERSION")
	if _, err := os.Stat(pgVersion); os.IsNotExist(err) {
		log.Printf("[PostgreSQL] Initializing data directory at %s", s.dataDir)
		initCmd := exec.Command(s.toolPath("initdb"),
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

// Start launches postgres or attaches to an existing listener on the port.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	if database.PortInUse("127.0.0.1", s.port) {
		s.externalMode = true
		s.state = service.StateRunning
		if database.IsExternalPostgresBinary(s.binaryPath) {
			log.Printf("[PostgreSQL] Port %d already in use — attached to existing PostgreSQL install.", s.port)
		} else {
			log.Printf("[PostgreSQL] Port %d already in use — attached to existing PostgreSQL instance.", s.port)
		}
		return nil
	}

	s.externalMode = false
	s.cmd = exec.Command(s.binaryPath,
		"-D", s.dataDir,
		"-p", fmt.Sprintf("%d", s.port),
		"-h", "127.0.0.1",
		"-k", "",
	)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start PostgreSQL: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[PostgreSQL] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)
	go s.ensureDevnestDatabase()
	go s.supervise()
	return nil
}

func (s *Server) supervise() {
	restartCount := 0
	for {
		err := s.cmd.Wait()

		s.mu.Lock()
		if s.state == service.StateStopped || s.externalMode {
			s.mu.Unlock()
			return
		}

		restartCount++
		if restartCount > maxRestartAttempts {
			log.Printf("[PostgreSQL] Exceeded %d restart attempts — giving up.", maxRestartAttempts)
			s.state = service.StateError
			s.mu.Unlock()
			return
		}
		s.mu.Unlock()

		log.Printf("[PostgreSQL] Crashed (Error: %v). Restarting in 3 seconds... (attempt %d/%d)", err, restartCount, maxRestartAttempts)
		time.Sleep(3 * time.Second)

		s.mu.Lock()
		if s.state == service.StateStopped {
			s.mu.Unlock()
			return
		}
		if database.PortInUse("127.0.0.1", s.port) {
			s.externalMode = true
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[PostgreSQL] Port %d is now in use — switching to external attach mode.", s.port)
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
}

// Stop gracefully shuts down PostgreSQL or detaches from an external instance.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.externalMode {
		s.externalMode = false
		s.state = service.StateStopped
		log.Printf("[PostgreSQL] Detached from external PostgreSQL on port %d (left it running)", s.port)
		return nil
	}

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		s.state = service.StateStopped
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[PostgreSQL] Stopping...")

	shutdownCmd := exec.Command(s.toolPath("pg_ctl"), "stop", "-D", s.dataDir, "-m", "fast")
	if err := shutdownCmd.Run(); err == nil {
		log.Printf("[PostgreSQL] Graceful shutdown successful")
		return nil
	}

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill PostgreSQL process: %w", err)
	}
	return nil
}

func (s *Server) HealthCheck() (service.HealthState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.externalMode && !database.PortInUse("127.0.0.1", s.port) {
		s.externalMode = false
		s.state = service.StateStopped
	}
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning {
		return &telemetry.ProcessMetrics{}, nil
	}
	if s.externalMode || s.cmd == nil || s.cmd.Process == nil {
		return &telemetry.ProcessMetrics{
			CPUPercent:  0.1,
			MemoryBytes: 67108864,
		}, nil
	}
	return &telemetry.ProcessMetrics{
		PID:         int32(s.cmd.Process.Pid),
		CPUPercent:  0.4,
		MemoryBytes: 67108864,
	}, nil
}

func (s *Server) ensureDevnestDatabase() {
	time.Sleep(2 * time.Second)
	cmd := exec.Command(s.toolPath("createdb"),
		"-h", "127.0.0.1",
		"-p", fmt.Sprintf("%d", s.port),
		"-U", "devnest",
		"devnest",
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		if !strings.Contains(string(out), "already exists") {
			log.Printf("[PostgreSQL] createdb devnest: %v (%s)", err, strings.TrimSpace(string(out)))
		}
	}
}
