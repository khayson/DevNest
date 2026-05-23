package cron

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

// Server represents a managed Laravel Task Scheduler (`schedule:work` or standard cron daemon alternative)
type Server struct {
	id          string
	phpBinary   string
	projectPath string
	cmd         *exec.Cmd
	state       service.HealthState
	mu          sync.Mutex
}

func NewServer(id, phpBinary, projectPath string) *Server {
	return &Server{
		id:          id,
		phpBinary:   phpBinary,
		projectPath: projectPath,
		state:       service.StateStopped,
	}
}

func (s *Server) ID() string      { return s.id }
func (s *Server) Name() string    { return fmt.Sprintf("Cron Scheduler - %s", filepath.Base(s.projectPath)) }
func (s *Server) Version() string { return "N/A" }
func (s *Server) Configure() error { return nil }

func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == service.StateRunning {
		return nil
	}

	// In local dev, schedule:work is much easier than configuring actual OS cron
	s.cmd = exec.Command(s.phpBinary, "artisan", "schedule:work")
	s.cmd.Dir = s.projectPath

	if err := s.cmd.Start(); err != nil {
		s.state = service.StateError
		return fmt.Errorf("failed to start cron scheduler %s: %w", s.id, err)
	}

	s.state = service.StateRunning
	log.Printf("[Cron] Started scheduler (PID: %d) for %s", s.cmd.Process.Pid, s.projectPath)

	go func() {
		for {
			err := s.cmd.Wait()

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}
			s.mu.Unlock()

			log.Printf("[Cron] %s crashed/exited (Error: %v). Restarting in 3 seconds...", s.id, err)
			time.Sleep(3 * time.Second)

			s.mu.Lock()
			if s.state == service.StateStopped {
				s.mu.Unlock()
				return
			}

			s.cmd = exec.Command(s.phpBinary, "artisan", "schedule:work")
			s.cmd.Dir = s.projectPath

			if err := s.cmd.Start(); err != nil {
				log.Printf("[Cron] %s failed to restart: %v", s.id, err)
				s.state = service.StateError
				s.mu.Unlock()
				return
			}
			s.state = service.StateRunning
			s.mu.Unlock()
			log.Printf("[Cron] %s auto-restarted (New PID: %d)", s.id, s.cmd.Process.Pid)
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
	log.Printf("[Cron] Stopping %s", s.id)

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill cron scheduler: %w", err)
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
		CPUPercent:  0.1,
		MemoryBytes: 25000000, 
	}, nil
}
