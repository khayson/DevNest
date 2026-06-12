package caddy

import (
	"bytes"
	"devnest/internal/config"
	"devnest/internal/service"
	"devnest/internal/service/php"
	"devnest/internal/telemetry"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Server represents the Caddy reverse proxy orchestrator.
type Server struct {
	binaryPath          string
	configDir           string
	caddyfilePath       string
	cmd                 *exec.Cmd
	state               service.HealthState
	mu                  sync.Mutex
	adminAPI            string
	getSites            func() []config.SiteEntry
	phpPortForSite      func(site config.SiteEntry) int
	binaryMissing       bool
	adopted             bool
	consecutiveFailures int
}

// NewServer initializes a new Caddy service manager.
func NewServer(binaryPath, configDir string, getSites func() []config.SiteEntry, phpPortForSite func(site config.SiteEntry) int) *Server {
	return &Server{
		binaryPath:     binaryPath,
		configDir:      configDir,
		caddyfilePath:  filepath.Join(configDir, "Caddyfile"),
		state:          service.StateStopped,
		adminAPI:       "http://127.0.0.1:2019",
		getSites:       getSites,
		phpPortForSite: phpPortForSite,
		binaryMissing:  binaryPath == "",
	}
}

func (s *Server) ID() string      { return "caddy-proxy" }
func (s *Server) Name() string    { return "Caddy Reverse Proxy" }
func (s *Server) Version() string { return "2.8.x" }

// BinaryAvailable reports whether a Caddy binary was resolved.
func (s *Server) BinaryAvailable() bool {
	return !s.binaryMissing && s.binaryPath != ""
}

// Configure writes the Caddyfile from registered sites.
func (s *Server) Configure() error {
	if s.binaryMissing {
		return fmt.Errorf("caddy binary not found - install caddy and add it to PATH, or place it in ~/.devnest/runtimes/caddy/")
	}

	if err := os.MkdirAll(s.configDir, 0700); err != nil {
		return err
	}

	sites := []config.SiteEntry{}
	if s.getSites != nil {
		sites = s.getSites()
	}

	content := generateCaddyfile(sites, s.phpPortForSite)
	if err := os.WriteFile(s.caddyfilePath, []byte(content), 0600); err != nil {
		return fmt.Errorf("failed to write Caddyfile: %w", err)
	}

	log.Printf("[Caddy] Wrote Caddyfile with %d site(s) to %s", len(sites), s.caddyfilePath)
	return nil
}

func generateCaddyfile(sites []config.SiteEntry, phpPortForSite func(site config.SiteEntry) int) string {
	var b strings.Builder
	b.WriteString("{\n")
	b.WriteString("\tadmin 127.0.0.1:2019\n")
	b.WriteString("\tlocal_certs\n")
	b.WriteString("}\n\n")

	if len(sites) == 0 {
		b.WriteString(":80 {\n")
		b.WriteString("\trespond \"DevNest Caddy is running. Add a site in the DevNest dashboard.\" 200\n")
		b.WriteString("}\n")
		return b.String()
	}

	for _, site := range sites {
		b.WriteString(site.Domain)
		b.WriteString(" {\n")
		if site.TLS {
			b.WriteString("\ttls internal\n")
		}
		if siteHasPublicIndex(site.Path) {
			root := filepath.ToSlash(filepath.Join(site.Path, "public"))
			port := php.DefaultCGIPort
			if phpPortForSite != nil {
				if p := phpPortForSite(site); p > 0 {
					port = p
				}
			}
			b.WriteString(fmt.Sprintf("\troot * \"%s\"\n", root))
			b.WriteString("\tencode gzip\n")
			b.WriteString(fmt.Sprintf("\tphp_fastcgi 127.0.0.1:%d\n", port))
			b.WriteString("\tfile_server\n")
		} else {
			b.WriteString(fmt.Sprintf("\treverse_proxy 127.0.0.1:%d\n", site.Port))
		}
		b.WriteString("}\n\n")
	}
	return b.String()
}

func siteHasPublicIndex(projectPath string) bool {
	if projectPath == "" {
		return false
	}
	st, err := os.Stat(filepath.Join(projectPath, "public", "index.php"))
	return err == nil && !st.IsDir()
}

// Start launches Caddy with the generated Caddyfile.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.binaryMissing {
		s.state = service.StateError
		return fmt.Errorf("caddy binary not found")
	}

	if s.state == service.StateRunning {
		return nil
	}

	// Reuse an existing DevNest Caddy already bound to the admin port (e.g. after UI reconnect).
	if s.adminHealthy() {
		s.state = service.StateRunning
		s.adopted = true
		s.consecutiveFailures = 0
		log.Printf("[Caddy] Reusing existing instance (admin API on %s)", s.adminAPI)
		return nil
	}

	s.adopted = false
	s.consecutiveFailures = 0

	if err := s.startProcessLocked(); err != nil {
		s.state = service.StateError
		return err
	}

	go s.supervise()
	return nil
}

func (s *Server) startProcessLocked() error {
	s.cmd = exec.Command(s.binaryPath, "run", "--config", s.caddyfilePath, "--adapter", "caddyfile")
	s.cmd.Dir = s.configDir

	logPath := filepath.Join(s.configDir, "caddy.log")
	if logFile, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
		s.cmd.Stdout = logFile
		s.cmd.Stderr = logFile
	}

	if err := s.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start caddy: %w", err)
	}

	s.state = service.StateRunning
	log.Printf("[Caddy] Started reverse proxy (PID: %d)", s.cmd.Process.Pid)
	return nil
}

func (s *Server) adminHealthy() bool {
	client := &http.Client{Timeout: 800 * time.Millisecond}
	resp, err := client.Get(s.adminAPI + "/config/")
	if err != nil || resp == nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (s *Server) supervise() {
	for {
		if s.cmd == nil {
			return
		}

		err := s.cmd.Wait()

		s.mu.Lock()
		if s.state == service.StateStopped {
			s.mu.Unlock()
			return
		}

		s.consecutiveFailures++
		failures := s.consecutiveFailures
		if failures >= 5 {
			s.state = service.StateError
			s.mu.Unlock()
			log.Printf("[Caddy] Stopped restarting after %d failures (port 2019 may be in use). Run .\\scripts\\stop-daemon.ps1 then start again.", failures)
			return
		}

		backoff := time.Duration(failures*3) * time.Second
		if backoff > 30*time.Second {
			backoff = 30 * time.Second
		}
		s.mu.Unlock()

		log.Printf("[Caddy] Process exited (%v). Restarting in %s (attempt %d/5)...", err, backoff, failures)
		time.Sleep(backoff)

		s.mu.Lock()
		if s.state == service.StateStopped {
			s.mu.Unlock()
			return
		}

		// Another instance may have claimed the port while we waited.
		if s.adminHealthy() {
			s.state = service.StateRunning
			s.adopted = true
			s.consecutiveFailures = 0
			s.mu.Unlock()
			log.Printf("[Caddy] Admin API active — attached to existing instance")
			return
		}

		if err := s.startProcessLocked(); err != nil {
			log.Printf("[Caddy] Failed to restart: %v", err)
			s.state = service.StateError
			s.mu.Unlock()
			return
		}
		s.consecutiveFailures = 0
		s.mu.Unlock()
	}
}

// Stop gracefully shuts down Caddy.
func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state != service.StateRunning {
		s.state = service.StateStopped
		s.adopted = false
		return nil
	}

	s.state = service.StateStopped
	s.adopted = false

	req, _ := http.NewRequest("POST", s.adminAPI+"/stop", nil)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			log.Printf("[Caddy] Graceful shutdown via admin API")
			s.cmd = nil
			return nil
		}
	}

	if s.cmd != nil && s.cmd.Process != nil {
		log.Printf("[Caddy] Forcing process kill")
		if err := s.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("failed to kill caddy process: %w", err)
		}
	}
	s.cmd = nil
	return nil
}

// HealthCheck verifies if the Admin API is responsive when running.
func (s *Server) HealthCheck() (service.HealthState, error) {
	s.mu.Lock()
	state := s.state
	s.mu.Unlock()

	if state != service.StateRunning {
		return state, nil
	}

	resp, err := http.Get(s.adminAPI + "/config/")
	if err != nil || resp == nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return service.StateError, fmt.Errorf("admin api unreachable")
	}
	resp.Body.Close()
	return service.StateRunning, nil
}

func (s *Server) GetMetrics() (*telemetry.ProcessMetrics, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state != service.StateRunning || s.cmd == nil || s.cmd.Process == nil {
		return &telemetry.ProcessMetrics{}, nil
	}
	return &telemetry.ProcessMetrics{
		PID: int32(s.cmd.Process.Pid),
	}, nil
}

// ReloadConfig regenerates the Caddyfile and triggers a config reload.
func (s *Server) ReloadConfig() error {
	if err := s.Configure(); err != nil {
		return err
	}

	s.mu.Lock()
	running := s.state == service.StateRunning
	s.mu.Unlock()
	if !running {
		return nil
	}

	req, _ := http.NewRequest("POST", s.adminAPI+"/load", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp == nil || resp.StatusCode >= 300 {
		// Fallback: use caddy reload CLI
		reload := exec.Command(s.binaryPath, "reload", "--config", s.caddyfilePath, "--adapter", "caddyfile")
		reload.Dir = s.configDir
		return reload.Run()
	}
	return nil
}

// AddRoute dynamically adds a route via the admin API (used after config reload).
func (s *Server) AddRoute(domain string, backendPort int) error {
	routePayload := map[string]interface{}{
		"match": []map[string]interface{}{
			{"host": []string{domain}},
		},
		"handle": []map[string]interface{}{
			{
				"handler": "reverse_proxy",
				"upstreams": []map[string]interface{}{
					{"dial": fmt.Sprintf("127.0.0.1:%d", backendPort)},
				},
			},
		},
	}

	payloadBytes, _ := json.Marshal(routePayload)
	endpoint := s.adminAPI + "/config/apps/http/servers/srv0/routes"
	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp == nil || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to add route for %s: %v", domain, err)
	}

	log.Printf("[Caddy] Added route %s -> 127.0.0.1:%d", domain, backendPort)
	return nil
}
