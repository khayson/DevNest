package mysql

import (
	"devnest/internal/service"
	"devnest/internal/service/database"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

const maxRestartAttempts = 3

// Server represents a managed MySQL/MariaDB process.
type Server struct {
	binaryPath     string
	devnestDataDir string
	dataDir        string
	port           int
	cmd            *exec.Cmd
	state          service.HealthState
	externalMode   bool
	managedData    bool
	restartCount   int
	mu             sync.Mutex
}

// NewServer initializes a new MySQL service manager.
func NewServer(binaryPath string, port int) *Server {
	homeDir, _ := os.UserHomeDir()
	devnestDir := filepath.Join(homeDir, ".devnest", "data", "mysql")
	dataDir, managed := database.MySQLDataDir(binaryPath, devnestDir)
	return &Server{
		binaryPath:     binaryPath,
		devnestDataDir: devnestDir,
		dataDir:        dataDir,
		port:           port,
		managedData:    managed,
		state:          service.StateStopped,
	}
}

func (s *Server) ID() string      { return "mysql" }
func (s *Server) Name() string    { return "MySQL Server" }
func (s *Server) Version() string { return "8.0" }

// ExternalMode is true when DevNest attached to an already-running MySQL (e.g. XAMPP).
func (s *Server) ExternalMode() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.externalMode
}

// Configure ensures the data directory exists and initializes MySQL if needed.
func (s *Server) Configure() error {
	s.dataDir, s.managedData = database.MySQLDataDir(s.binaryPath, s.devnestDataDir)

	if !s.managedData {
		log.Printf("[MySQL] Using stack data directory: %s", s.dataDir)
		return nil
	}

	if err := os.MkdirAll(s.dataDir, 0700); err != nil {
		return fmt.Errorf("failed to create MySQL data dir: %w", err)
	}

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

func (s *Server) buildArgs() []string {
	if !s.managedData {
		if defaults := database.MySQLDefaultsFile(s.binaryPath); defaults != "" {
			return []string{"--defaults-file=" + defaults}
		}
	}

	return []string{
		"--datadir=" + s.dataDir,
		fmt.Sprintf("--port=%d", s.port),
		"--bind-address=127.0.0.1",
		"--skip-grant-tables",
		"--innodb-flush-method=normal",
		"--innodb-buffer-pool-size=128M",
		"--max-connections=50",
	}
}

// Start launches mysqld or attaches to an existing listener on the port.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.dataDir, s.managedData = database.MySQLDataDir(s.binaryPath, s.devnestDataDir)

	if database.PortInUse("127.0.0.1", s.port) {
		s.externalMode = true
		s.state = service.StateRunning
		s.restartCount = 0
		if database.IsExternalMySQLBinary(s.binaryPath) {
			log.Printf("[MySQL] Port %d already in use — attached to existing MySQL (XAMPP/Laragon). DevNest will not start a second server.", s.port)
		} else {
			log.Printf("[MySQL] Port %d already in use — attached to existing MySQL instance.", s.port)
		}
		return nil
	}

	s.externalMode = false
	s.cmd = exec.Command(s.binaryPath, s.buildArgs()...)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start MySQL: %w", err)
	}

	s.state = service.StateRunning
	s.restartCount = 0
	log.Printf("[MySQL] Started (PID: %d) on port %d (datadir: %s)", s.cmd.Process.Pid, s.port, s.dataDir)

	go s.supervise()
	return nil
}

func (s *Server) supervise() {
	for {
		err := s.cmd.Wait()

		s.mu.Lock()
		if s.state == service.StateStopped || s.externalMode {
			s.mu.Unlock()
			return
		}

		s.restartCount++
		if s.restartCount > maxRestartAttempts {
			log.Printf("[MySQL] Exceeded %d restart attempts — giving up. Check if port %d is in use or start MySQL from XAMPP.", maxRestartAttempts, s.port)
			s.state = service.StateError
			s.mu.Unlock()
			return
		}
		s.mu.Unlock()

		log.Printf("[MySQL] Crashed (Error: %v). Restarting in 3 seconds... (attempt %d/%d)", err, s.restartCount, maxRestartAttempts)
		time.Sleep(3 * time.Second)

		s.mu.Lock()
		if s.state == service.StateStopped {
			s.mu.Unlock()
			return
		}

		if database.PortInUse("127.0.0.1", s.port) {
			log.Printf("[MySQL] Port %d is now in use — switching to external attach mode.", s.port)
			s.externalMode = true
			s.state = service.StateRunning
			s.mu.Unlock()
			return
		}

		s.cmd = exec.Command(s.binaryPath, s.buildArgs()...)
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
}

// Stop gracefully shuts down MySQL (or detaches from external instance).
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.externalMode {
		s.externalMode = false
		s.state = service.StateStopped
		log.Printf("[MySQL] Detached from external MySQL on port %d (left it running)", s.port)
		return nil
	}

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		s.state = service.StateStopped
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[MySQL] Stopping...")

	adminPath := filepath.Join(filepath.Dir(s.binaryPath), "mysqladmin")
	shutdownCmd := exec.Command(adminPath, "-u", "root", fmt.Sprintf("--port=%d", s.port), "shutdown")
	if err := shutdownCmd.Run(); err == nil {
		log.Printf("[MySQL] Graceful shutdown successful")
		return nil
	}

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill MySQL process: %w", err)
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
			MemoryBytes: 134217728,
		}, nil
	}
	return &telemetry.ProcessMetrics{
		PID:         int32(s.cmd.Process.Pid),
		CPUPercent:  0.5,
		MemoryBytes: 134217728,
	}, nil
}
