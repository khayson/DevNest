package node

import (
	"devnest/internal/service"
	"devnest/internal/service/processlog"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Server represents a managed Node.js dev server (npm run dev).
type Server struct {
	id          string
	domain      string
	inst        Installation
	projectPath string
	port        int
	cmd         *exec.Cmd
	state       service.HealthState
	mu          sync.Mutex
}

func NewServer(id, domain string, inst Installation, projectPath string, port int) *Server {
	return &Server{
		id:          id,
		domain:      domain,
		inst:        inst,
		projectPath: projectPath,
		port:        port,
		state:       service.StateStopped,
	}
}

func (s *Server) ID() string       { return s.id }
func (s *Server) Name() string     { return fmt.Sprintf("Node Dev - %s", filepath.Base(s.projectPath)) }
func (s *Server) Version() string  { return s.inst.Version }
func (s *Server) Configure() error { return nil }

func (s *Server) ProjectPath() string { return s.projectPath }
func (s *Server) Port() int           { return s.port }

func (s *Server) Update(inst Installation, projectPath string, port int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.inst = inst
	s.projectPath = projectPath
	s.port = port
}

func (s *Server) buildCommand() *exec.Cmd {
	npm := ResolveNPM(s.inst)
	args := []string{"run", "dev"}
	if s.port > 0 {
		args = append(args, "--", "--port", fmt.Sprintf("%d", s.port))
	}
	cmd := exec.Command(npm, args...)
	cmd.Dir = s.projectPath
	return cmd
}

func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}
	if ResolveNPM(s.inst) == "" {
		s.state = service.StateError
		return fmt.Errorf("npm not found for node at %s", s.inst.Binary)
	}

	s.cmd = s.buildCommand()
	processlog.Global().Append(s.id, s.domain, "node", "stdout",
		fmt.Sprintf("[DevNest] npm run dev (port %d)", s.port))
	if err := processlog.AttachPipes(s.cmd, s.id, s.domain, "node"); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to attach node pipes: %w", err)
	}

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start node process %s: %w", s.id, err)
	}

	s.state = service.StateRunning
	log.Printf("[Node] Started dev server (PID: %d) on port %d for %s", s.cmd.Process.Pid, s.port, s.projectPath)

	go s.supervise()
	return nil
}

func (s *Server) supervise() {
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

		s.cmd = s.buildCommand()
		_ = processlog.AttachPipes(s.cmd, s.id, s.domain, "node")
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
}

func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		s.state = service.StateStopped
		return nil
	}

	s.state = service.StateStopped
	log.Printf("[Node] Stopping %s", s.id)

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill node process: %w", err)
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
		MemoryBytes: 85000000,
	}, nil
}
