package tunnel

import (
	"bufio"
	"fmt"
	"log"
	"os/exec"
	"regexp"
	"sync"
)

// Manager orchestrates public tunnels using cloudflared.
type Manager struct {
	binaryPath string
	activeCmds map[string]*exec.Cmd
	mu         sync.Mutex
}

// NewManager initializes the tunnel manager.
func NewManager(binaryPath string) *Manager {
	return &Manager{
		binaryPath: binaryPath,
		activeCmds: make(map[string]*exec.Cmd),
	}
}

// StartTunnel spawns cloudflared for a site key, local port, and optional Host header.
func (m *Manager) StartTunnel(key string, localPort int, hostHeader string, onURLReady func(url string)) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.activeCmds[key]; exists {
		return fmt.Errorf("tunnel already active for %s", key)
	}

	args := []string{"tunnel", "--url", fmt.Sprintf("http://127.0.0.1:%d", localPort)}
	if hostHeader != "" {
		args = append(args, "--http-host-header", hostHeader)
	}

	cmd := exec.Command(m.binaryPath, args...)

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start cloudflared: %w", err)
	}

	m.activeCmds[key] = cmd
	log.Printf("[Tunnel] Starting %s -> 127.0.0.1:%d (Host: %q)", key, localPort, hostHeader)

	go func() {
		scanner := bufio.NewScanner(stderr)
		urlRegex := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)

		for scanner.Scan() {
			line := scanner.Text()
			if match := urlRegex.FindString(line); match != "" {
				log.Printf("[Tunnel] %s mapped to %s", key, match)
				if onURLReady != nil {
					onURLReady(match)
				}
				break
			}
		}

		err := cmd.Wait()
		log.Printf("[Tunnel] Cloudflared exited for %s: %v", key, err)

		m.mu.Lock()
		delete(m.activeCmds, key)
		m.mu.Unlock()
	}()

	return nil
}

// StopTunnel terminates the cloudflared process for a site key.
func (m *Manager) StopTunnel(key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd, exists := m.activeCmds[key]
	if !exists {
		return nil
	}

	if err := cmd.Process.Kill(); err != nil {
		return err
	}

	delete(m.activeCmds, key)
	return nil
}
