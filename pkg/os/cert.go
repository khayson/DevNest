package osutil

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// InjectCaddyRootCA locates Caddy's auto-generated root certificate and
// injects it into the system's Trust Store so local HTTPS works without warnings.
func InjectCaddyRootCA() error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("CA injection currently only implemented for Windows")
	}

	appData, err := os.UserConfigDir() // Usually C:\Users\Name\AppData\Roaming
	if err != nil {
		return fmt.Errorf("could not find AppData directory: %w", err)
	}

	certPath := filepath.Join(appData, "Caddy", "pki", "authorities", "local", "root.crt")
	
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return fmt.Errorf("caddy root cert not found at %s. Caddy must be run at least once to generate it", certPath)
	}

	// certutil -addstore -f "Root" <cert_path>
	// Requires elevated privileges on Windows.
	cmd := exec.Command("certutil", "-addstore", "-f", "Root", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to inject certificate: %s, output: %s", err, string(output))
	}

	return nil
}
