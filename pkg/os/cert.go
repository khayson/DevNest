package osutil

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// InjectCaddyRootCA locates Caddy's auto-generated root certificate and
// injects it into the system's Trust Store so local HTTPS works without warnings.
func InjectCaddyRootCA() error {
	switch runtime.GOOS {
	case "windows":
		return injectCAWindows()
	case "darwin":
		return injectCAMacOS()
	case "linux":
		return injectCALinux()
	default:
		return fmt.Errorf("CA injection not supported on %s", runtime.GOOS)
	}
}

// findCaddyRootCert locates Caddy's auto-generated root.crt across platforms.
func findCaddyRootCert() (string, error) {
	var baseDir string
	var err error

	switch runtime.GOOS {
	case "windows":
		baseDir, err = os.UserConfigDir() // %AppData%\Roaming
	case "darwin":
		homeDir, _ := os.UserHomeDir()
		baseDir = filepath.Join(homeDir, "Library", "Application Support")
		err = nil
	case "linux":
		baseDir, err = os.UserConfigDir() // ~/.config
	default:
		return "", fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}

	if err != nil {
		return "", fmt.Errorf("could not find config directory: %w", err)
	}

	certPath := filepath.Join(baseDir, "Caddy", "pki", "authorities", "local", "root.crt")

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return "", fmt.Errorf("caddy root cert not found at %s — Caddy must be run at least once to generate it", certPath)
	}

	return certPath, nil
}

func injectCAWindows() error {
	certPath, err := findCaddyRootCert()
	if err != nil {
		return err
	}

	// certutil -addstore -f "Root" <cert_path>
	cmd := exec.Command("certutil", "-addstore", "-f", "Root", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to inject certificate: %s, output: %s", err, string(output))
	}

	log.Printf("[CA] Root certificate injected into Windows Trust Store")
	return nil
}

func injectCAMacOS() error {
	certPath, err := findCaddyRootCert()
	if err != nil {
		return err
	}

	// security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <cert_path>
	cmd := exec.Command("security", "add-trusted-cert", "-d", "-r", "trustRoot",
		"-k", "/Library/Keychains/System.keychain", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to inject certificate on macOS: %s, output: %s", err, string(output))
	}

	log.Printf("[CA] Root certificate injected into macOS Keychain")
	return nil
}

func injectCALinux() error {
	certPath, err := findCaddyRootCert()
	if err != nil {
		return err
	}

	// Copy cert to system CA directory and update
	destPath := "/usr/local/share/ca-certificates/devnest-caddy-root.crt"

	input, err := os.ReadFile(certPath)
	if err != nil {
		return err
	}

	if err := os.WriteFile(destPath, input, 0644); err != nil {
		return fmt.Errorf("failed to copy cert to %s (requires sudo): %w", destPath, err)
	}

	cmd := exec.Command("update-ca-certificates")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to update CA certificates: %s, output: %s", err, string(output))
	}

	log.Printf("[CA] Root certificate injected into Linux CA store")
	return nil
}
