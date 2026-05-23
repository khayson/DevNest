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
	activeCmds map[int]*exec.Cmd
	mu         sync.Mutex
}

// NewManager initializes the tunnel manager.
func NewManager(binaryPath string) *Manager {
	return &Manager{
		binaryPath: binaryPath,
		activeCmds: make(map[int]*exec.Cmd),
	}
}

// StartTunnel spawns `cloudflared tunnel` for a specific local port and extracts the public URL.
func (m *Manager) StartTunnel(localPort int, onUrlReady func(url string)) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.activeCmds[localPort]; exists {
		return fmt.Errorf("tunnel already active for port %d", localPort)
	}

	// Example: cloudflared tunnel --url http://127.0.0.1:8000
	cmd := exec.Command(m.binaryPath, "tunnel", "--url", fmt.Sprintf("http://127.0.0.1:%d", localPort))
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start cloudflared: %w", err)
	}

	m.activeCmds[localPort] = cmd

	// Cloudflared logs the URL to stderr
	go func() {
		scanner := bufio.NewScanner(stderr)
		urlRegex := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)
		
		for scanner.Scan() {
			line := scanner.Text()
			// Search for the public URL
			if match := urlRegex.FindString(line); match != "" {
				log.Printf("[Tunnel] Port %d mapped to %s", localPort, match)
				if onUrlReady != nil {
					onUrlReady(match)
				}
				break // URL found, stop scanning to save resources (or continue to log)
			}
		}
		
		// Wait for process to exit
		err := cmd.Wait()
		log.Printf("[Tunnel] Cloudflared exited for port %d: %v", localPort, err)
		
		m.mu.Lock()
		delete(m.activeCmds, localPort)
		m.mu.Unlock()
	}()

	return nil
}

// StopTunnel terminates the cloudflared process for a given port.
func (m *Manager) StopTunnel(localPort int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd, exists := m.activeCmds[localPort]
	if !exists {
		return nil
	}

	if err := cmd.Process.Kill(); err != nil {
		return err
	}

	delete(m.activeCmds, localPort)
	return nil
}
