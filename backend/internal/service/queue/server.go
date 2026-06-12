package queue

import (
	"devnest/internal/service"
	"devnest/internal/service/processlog"
	"devnest/internal/telemetry"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Server represents a managed Laravel Queue Worker process.
type Server struct {
	id          string
	domain      string
	phpBinary   string
	projectPath string
	opts        WorkerOptions
	cmd         *exec.Cmd
	state       service.HealthState
	mu          sync.Mutex
}

// NewServer initializes a new Queue Worker supervisor for a specific project.
func NewServer(id, domain, phpBinary, projectPath string, opts WorkerOptions) *Server {
	return &Server{
		id:          id,
		domain:      domain,
		phpBinary:   phpBinary,
		projectPath: projectPath,
		opts:        opts,
		state:       service.StateStopped,
	}
}

func (s *Server) Domain() string { return s.domain }

func (s *Server) ID() string      { return s.id }
func (s *Server) Name() string    { return fmt.Sprintf("Queue Worker - %s", filepath.Base(s.projectPath)) }
func (s *Server) Version() string { return "N/A" }
func (s *Server) Configure() error { return nil }

func (s *Server) PHPBinary() string    { return s.phpBinary }
func (s *Server) ProjectPath() string  { return s.projectPath }
func (s *Server) Connection() string   { return s.opts.Connection }

func (s *Server) UpdateOptions(phpBinary, projectPath string, opts WorkerOptions) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.phpBinary = phpBinary
	s.projectPath = projectPath
	s.opts = opts
}

func (s *Server) buildCommand() *exec.Cmd {
	args := s.buildArgs()
	cmd := exec.Command(s.phpBinary, args...)
	cmd.Dir = s.projectPath
	return cmd
}

func (s *Server) buildArgs() []string {
	args := []string{"artisan", "queue:work"}
	conn := s.opts.Connection
	if conn != "" && conn != "sync" {
		args = append(args, conn)
	}
	if s.opts.Queues != "" {
		args = append(args, "--queue="+s.opts.Queues)
	}
	if s.opts.Tries > 0 {
		args = append(args, "--tries="+strconv.Itoa(s.opts.Tries))
	}
	if s.opts.Timeout > 0 {
		args = append(args, "--timeout="+strconv.Itoa(s.opts.Timeout))
	}
	if s.opts.Memory > 0 {
		args = append(args, "--memory="+strconv.Itoa(s.opts.Memory))
	}
	return args
}

func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	s.cmd = s.buildCommand()
	processlog.Global().Append(s.id, s.domain, "queue", "stdout",
		fmt.Sprintf("[DevNest] queue:work %s", strings.Join(s.buildArgs()[2:], " ")))
	if err := processlog.AttachPipes(s.cmd, s.id, s.domain, "queue"); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to attach queue worker pipes: %w", err)
	}
	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start queue worker %s: %w", s.id, err)
	}

	s.state = service.StateRunning
	log.Printf("[Queue] Started worker (PID: %d) for %s", s.cmd.Process.Pid, s.projectPath)

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

		log.Printf("[Queue] %s crashed/exited (Error: %v). Restarting in 3 seconds...", s.id, err)
		time.Sleep(3 * time.Second)

		s.mu.Lock()
		if s.state == service.StateStopped {
			s.mu.Unlock()
			return
		}

		s.cmd = s.buildCommand()
		_ = processlog.AttachPipes(s.cmd, s.id, s.domain, "queue")
		if err := s.cmd.Start(); err != nil {
			log.Printf("[Queue] %s failed to restart: %v", s.id, err)
			s.state = service.StateError
			s.mu.Unlock()
			return
		}
		s.state = service.StateRunning
		s.mu.Unlock()
		log.Printf("[Queue] %s auto-restarted (New PID: %d)", s.id, s.cmd.Process.Pid)
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
	log.Printf("[Queue] Stopping %s", s.id)

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill queue worker: %w", err)
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
		MemoryBytes: 30000000,
	}, nil
}
