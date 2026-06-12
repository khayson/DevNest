package php

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
)

const DefaultCGIPort = 9074

// Installation describes a detected PHP binary on the system.
type Installation struct {
	Version   string `json:"version"`
	Label     string `json:"label"`
	Binary    string `json:"binary"`
	CGIPath   string `json:"cgi_path"`
	IniPath   string `json:"ini_path"`
	Installed bool   `json:"installed"`
}

var versionRegex = regexp.MustCompile(`(?i)PHP\s+(\d+\.\d+\.\d+)`)

// DiscoverInstallations scans PATH and ~/.devnest/runtimes/php for PHP binaries.
func DiscoverInstallations() []Installation {
	seen := map[string]bool{}
	var out []Installation

	add := func(binary string) {
		binary = filepath.Clean(binary)
		if seen[binary] {
			return
		}
		inst, ok := inspectBinary(binary)
		if !ok {
			return
		}
		seen[binary] = true
		out = append(out, inst)
	}

	if path, err := exec.LookPath("php"); err == nil {
		add(path)
	}
	if path, err := exec.LookPath("php-cgi"); err == nil {
		add(path)
	}

	home, err := os.UserHomeDir()
	if err == nil {
		runtimeRoot := filepath.Join(home, ".devnest", "runtimes", "php")
		_ = filepath.WalkDir(runtimeRoot, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			name := strings.ToLower(d.Name())
			if name == "php.exe" || name == "php" || name == "php-cgi.exe" || name == "php-cgi" {
				add(path)
			}
			return nil
		})
	}

	sort.Slice(out, func(i, j int) bool {
		return compareVersions(out[i].Version, out[j].Version) > 0
	})
	return out
}

func inspectBinary(binary string) (Installation, bool) {
	cmd := exec.Command(binary, "-v")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return Installation{}, false
	}

	match := versionRegex.FindStringSubmatch(string(out))
	if len(match) < 2 {
		return Installation{}, false
	}

	version := match[1]
	dir := filepath.Dir(binary)
	base := filepath.Base(binary)
	cgiPath := binary
	if strings.EqualFold(base, "php.exe") || base == "php" {
		candidate := filepath.Join(dir, "php-cgi.exe")
		if runtime.GOOS != "windows" {
			candidate = filepath.Join(dir, "php-cgi")
		}
		if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
			cgiPath = candidate
		}
	}

	iniPath := detectIniPath(dir, binary)

	return Installation{
		Version:   version,
		Label:     "PHP " + strings.TrimSuffix(version, ".0"),
		Binary:    binary,
		CGIPath:   cgiPath,
		IniPath:   iniPath,
		Installed: true,
	}, true
}

func detectIniPath(dir, binary string) string {
	candidates := []string{
		filepath.Join(dir, "php.ini"),
		filepath.Join(dir, "..", "php.ini"),
	}
	if ini, err := exec.Command(binary, "--ini").Output(); err == nil {
		for _, line := range strings.Split(string(ini), "\n") {
			line = strings.TrimSpace(line)
			if strings.Contains(line, "Loaded Configuration File") {
				parts := strings.SplitN(line, "=>", 2)
				if len(parts) == 2 {
					p := strings.TrimSpace(parts[1])
					if p != "" && !strings.EqualFold(p, "(none)") {
						return p
					}
				}
			}
		}
	}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

// PickInstallation selects the install matching version or path, else the newest.
func PickInstallation(installs []Installation, activeVersion, activePath string) (Installation, bool) {
	if activePath != "" {
		for _, inst := range installs {
			if filepath.Clean(inst.Binary) == filepath.Clean(activePath) ||
				filepath.Clean(inst.CGIPath) == filepath.Clean(activePath) {
				return inst, true
			}
		}
	}
	if activeVersion != "" {
		for _, inst := range installs {
			if inst.Version == activeVersion || inst.Label == activeVersion {
				return inst, true
			}
		}
	}
	if len(installs) > 0 {
		return installs[0], true
	}
	return Installation{}, false
}

func compareVersions(a, b string) int {
	ap := strings.Split(a, ".")
	bp := strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		av, bv := 0, 0
		if i < len(ap) {
			fmt.Sscanf(ap[i], "%d", &av)
		}
		if i < len(bp) {
			fmt.Sscanf(bp[i], "%d", &bv)
		}
		if av != bv {
			return av - bv
		}
	}
	return 0
}

// ReadDirectives returns common php.ini values for the UI.
func ReadDirectives(iniPath string) map[string]string {
	keys := []string{"memory_limit", "max_execution_time", "upload_max_filesize"}
	out := map[string]string{
		"memory_limit":         "128M",
		"max_execution_time":   "30",
		"upload_max_filesize":  "2M",
	}
	if iniPath == "" {
		return out
	}
	mgr := NewExtensionManager(iniPath)
	for _, key := range keys {
		if val, err := mgr.GetINIValue(key); err == nil && val != "" {
			out[key] = val
		}
	}
	return out
}
