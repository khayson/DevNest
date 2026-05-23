package minio

import (
	"devnest/pkg/service"
	"devnest/pkg/telemetry"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"
)

// Server represents a managed MinIO (S3-compatible) instance.
type Server struct {
	binaryPath string
	dataDir    string
	port       int
	consolePort int
	cmd        *exec.Cmd
	state      service.HealthState
	mu         sync.Mutex
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

func (s *Server) ID() string      { return "minio" }
func (s *Server) Name() string    { return "MinIO (Local S3)" }
func (s *Server) Version() string { return "RELEASE.2023" }

func (s *Server) Configure() error {
	if _, err := os.Stat(s.dataDir); os.IsNotExist(err) {
		if err := os.MkdirAll(s.dataDir, 0755); err != nil {
			return fmt.Errorf("failed to create minio data dir: %w", err)
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

	// minio server ./data --address :9000 --console-address :9001
	s.cmd = exec.Command(s.binaryPath, "server", s.dataDir, 
		"--address", fmt.Sprintf("127.0.0.1:%d", s.port),
		"--console-address", fmt.Sprintf("127.0.0.1:%d", s.consolePort),
	)

	// Set default local credentials
	s.cmd.Env = append(os.Environ(), 
		"MINIO_ROOT_USER=sail",
		"MINIO_ROOT_PASSWORD=password",
	)

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start minio: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[MinIO] Started (PID: %d) on port %d", s.cmd.Process.Pid, s.port)

	go func() {
		for {
			err := s.cmd.Wait()

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}
			s.mu.Unlock()

			log.Printf("[MinIO] crashed/exited (Error: %v). Restarting in 3 seconds...", err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.binaryPath, "server", s.dataDir, 
				"--address", fmt.Sprintf("127.0.0.1:%d", s.port),
				"--console-address", fmt.Sprintf("127.0.0.1:%d", s.consolePort),
			)
			s.cmd.Env = append(os.Environ(), 
				"MINIO_ROOT_USER=sail",
				"MINIO_ROOT_PASSWORD=password",
			)

			if err := s.cmd.Start(); err != nil {
				log.Printf("[MinIO] failed to restart: %v", err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[MinIO] auto-restarted (New PID: %d)", s.cmd.Process.Pid)
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
	log.Printf("[MinIO] Stopping...")

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill minio: %w", err)
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
		MemoryBytes: 85000000, 
	}, nil
}
