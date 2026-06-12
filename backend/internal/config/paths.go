package config

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// DevnestDir returns ~/.devnest (created if missing).
func DevnestDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".devnest")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

// CaddyConfigDir returns ~/.devnest/caddy.
func CaddyConfigDir() (string, error) {
	base, err := DevnestDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "caddy")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

// LogsDir returns ~/.devnest/logs (created if missing).
func LogsDir() (string, error) {
	base, err := DevnestDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "logs")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

// ResolveCaddyBinary finds caddy in ~/.devnest/runtimes or on PATH.
func ResolveCaddyBinary() (string, error) {
	base, err := DevnestDir()
	if err != nil {
		return "", err
	}

	candidates := []string{
		filepath.Join(base, "runtimes", "caddy", "caddy.exe"),
		filepath.Join(base, "runtimes", "caddy", "caddy"),
	}
	if runtime.GOOS == "windows" {
		candidates = append(candidates, filepath.Join(base, "runtimes", "caddy", "caddy_windows_amd64.exe"))
	}

	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}

	if path, err := exec.LookPath("caddy"); err == nil {
		return path, nil
	}

	return "", os.ErrNotExist
}
