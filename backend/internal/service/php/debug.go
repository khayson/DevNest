package php

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

// DebugSettings configures Xdebug for step debugging.
type DebugSettings struct {
	Port    int    `json:"port"`
	IDEKey  string `json:"ide_key"`
	Mode    string `json:"mode"`
	Enabled bool   `json:"enabled"`
}

const defaultDebugPort = 9003

// ConfigureDebugSession enables or disables Xdebug with IDE-friendly defaults.
func ConfigureDebugSession(iniPath string, enable bool, settings DebugSettings) error {
	if iniPath == "" {
		return fmt.Errorf("no php.ini path")
	}
	if settings.Port <= 0 {
		settings.Port = defaultDebugPort
	}
	if settings.IDEKey == "" {
		settings.IDEKey = "PHPSTORM"
	}
	if settings.Mode == "" {
		settings.Mode = "debug,develop"
	}

	mgr := NewExtensionManager(iniPath)
	if enable {
		if err := mgr.ToggleExtension("xdebug", true); err != nil {
			return err
		}
		return applyDebugDirectives(iniPath, settings)
	}
	if err := mgr.ToggleExtension("xdebug", false); err != nil {
		return err
	}
	return removeDebugDirectives(iniPath)
}

func applyDebugDirectives(iniPath string, settings DebugSettings) error {
	lines, err := readIniLines(iniPath)
	if err != nil {
		return err
	}
	directives := map[string]string{
		"xdebug.mode":                 settings.Mode,
		"xdebug.start_with_request":   "yes",
		"xdebug.client_port":          fmt.Sprintf("%d", settings.Port),
		"xdebug.idekey":               settings.IDEKey,
		"xdebug.discover_client_host": "1",
	}
	lines = upsertIniDirectives(lines, directives)
	return writeIniLines(iniPath, lines)
}

func removeDebugDirectives(iniPath string) error {
	lines, err := readIniLines(iniPath)
	if err != nil {
		return err
	}
	prefixes := []string{"xdebug.mode", "xdebug.start_with_request", "xdebug.client_port", "xdebug.idekey", "xdebug.discover_client_host"}
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		skip := false
		for _, prefix := range prefixes {
			if strings.HasPrefix(trimmed, prefix+"=") || strings.HasPrefix(trimmed, ";"+prefix+"=") {
				skip = true
				break
			}
		}
		if !skip {
			filtered = append(filtered, line)
		}
	}
	return writeIniLines(iniPath, filtered)
}

func readIniLines(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	return strings.Split(text, "\n"), nil
}

func writeIniLines(path string, lines []string) error {
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0644)
}

func upsertIniDirectives(lines []string, directives map[string]string) []string {
	for key, value := range directives {
		re := regexp.MustCompile(`(?i)^\s*;*\s*` + regexp.QuoteMeta(key) + `\s*=`)
		replaced := false
		for i, line := range lines {
			if re.MatchString(line) {
				lines[i] = key + "=" + value
				replaced = true
				break
			}
		}
		if !replaced {
			lines = append(lines, "", "; DevNest debug session", key+"="+value)
		}
	}
	return lines
}

// DetectXdebugReady reports whether Xdebug appears configured for debugging.
func DetectXdebugReady(iniPath string) bool {
	enabled, err := NewExtensionManager(iniPath).IsExtensionEnabled("xdebug")
	if err != nil || !enabled {
		return false
	}
	lines, err := readIniLines(iniPath)
	if err != nil {
		return false
	}
	for _, line := range lines {
		trimmed := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), ";"))
		if strings.HasPrefix(trimmed, "xdebug.mode=") && strings.Contains(trimmed, "debug") {
			return true
		}
	}
	return false
}
