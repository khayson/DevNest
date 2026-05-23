package node

import (
	"devnest/internal/service"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Server represents a managed Node.js process, typically running `npm run dev` (Vite).
type Server struct {
	id          string
	binaryPath  string
	projectPath string
	port        int
	cmd         *exec.Cmd
	state       service.HealthState
	mu          sync.Mutex
}

// NewServer initializes a new Node.js process manager for a specific project.
func NewServer(id, binaryPath, projectPath string, port int) *Server {
	return &Server{
		id:          id,
		binaryPath:  binaryPath,
		projectPath: projectPath,
		port:        port,
		state:       service.StateStopped,
	}
}

func (s *Server) ID() string      { return s.id }
func (s *Server) Name() string    { return fmt.Sprintf("Node.js (Vite) - %s", filepath.Base(s.projectPath)) }
func (s *Server) Version() string { return "v20" } // This would be dynamic based on installed version

func (s *Server) Configure() error { return nil }

// Start launches `npm run dev` or the equivalent dev server.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	npmPath := filepath.Join(filepath.Dir(s.binaryPath), "npm.cmd") // Assuming Windows for now
	s.cmd = exec.Command(npmPath, "run", "dev", "--", "--port", fmt.Sprintf("%d", s.port))
	s.cmd.Dir = s.projectPath

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start Node.js process %s: %w", s.id, err)
	}

	s.state = service.StateRunning
	log.Printf("[Node] Started Vite server (PID: %d) on port %d for %s", s.cmd.Process.Pid, s.port, s.projectPath)

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

			log.Printf("[Node] %s crashed or exited (Error: %v). Restarting in 3 seconds...", s.id, err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(npmPath, "run", "dev", "--", "--port", fmt.Sprintf("%d", s.port))
			s.cmd.Dir = s.projectPath

			if err := s.cmd.Start(); err != nil {
				log.Printf("[Node] %s failed to restart: %v", s.id, err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[Node] %s auto-restarted (New PID: %d)", s.id, s.cmd.Process.Pid)
		}
	}()

	return nil
}

// Stop gracefully stops the Node.js process.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[Node] Stopping %s", s.id)

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill Node.js process: %w", err)
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
		CPUPercent:  1.5,
		MemoryBytes: 85000000, // Node processes are typically ~85MB idle
	}, nil
}
