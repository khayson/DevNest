package rustfs

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
)

// Server represents a managed RustFS (S3-compatible) instance.
type Server struct {
	binaryPath  string
	dataDir     string
	port        int
	consolePort int
	cmd         *exec.Cmd
	state       service.HealthState
	mu          sync.Mutex
}

func NewServer(binaryPath, dataDir string, port, consolePort int) *Server {
	return &Server{
		binaryPath:  binaryPath,
		dataDir:     dataDir,
		port:        port,
		consolePort: consolePort,
		state:       service.StateStopped,
	}
}

func (s *Server) ID() string      { return "rustfs" }
func (s *Server) Name() string    { return "RustFS (Local S3)" }
func (s *Server) Version() string { return "latest" }

func (s *Server) Configure() error {
	return os.MkdirAll(s.dataDir, 0755)
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
	s.cmd = exec.Command(s.binaryPath, "server", s.dataDir,
		"--address", fmt.Sprintf("127.0.0.1:%d", s.port),
		"--console-address", fmt.Sprintf("127.0.0.1:%d", s.consolePort),
	)
	s.cmd.Env = append(os.Environ(),
		"RUSTFS_ROOT_USER=sail",
		"RUSTFS_ROOT_PASSWORD=password",
	)
	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start rustfs: %w", err)
	}
	s.state = service.StateRunning
	log.Printf("[RustFS] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)
	go func() {
		_ = s.cmd.Wait()
		s.mu.Lock()
		s.state = service.StateStopped
		s.mu.Unlock()
	}()
	return nil
}

func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cmd == nil || s.cmd.Process == nil {
		s.state = service.StateStopped
		return nil
	}
	_ = s.cmd.Process.Kill()
	s.state = service.StateStopped
	return nil
}

func (s *Server) HealthCheck() (service.HealthState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state == service.StateRunning && s.cmd != nil && s.cmd.Process != nil {
		return service.StateRunning, nil
	}
	return s.state, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return &telemetry.ProcessMetrics{}, nil
	}
	return &telemetry.ProcessMetrics{
		PID:         int32(s.cmd.Process.Pid),
		CPUPercent:  0.5,
		MemoryBytes: 85000000,
	}, nil
}

func (s *Server) Port() int { return s.port }
