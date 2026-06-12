package node

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

// Installation describes a detected Node.js binary.
type Installation struct {
	Version   string `json:"version"`
	Label     string `json:"label"`
	Binary    string `json:"binary"`
	NPMBinary string `json:"npm_binary"`
	Installed bool   `json:"installed"`
}

// DiscoverInstallations scans PATH and common version managers.
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

	if path, err := exec.LookPath("node"); err == nil {
		add(path)
	}

	home, _ := os.UserHomeDir()
	if runtime.GOOS == "windows" && home != "" {
		nvmRoot := os.Getenv("NVM_HOME")
		if nvmRoot == "" {
			nvmRoot = filepath.Join(os.Getenv("APPDATA"), "nvm")
		}
		_ = filepath.WalkDir(nvmRoot, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			if strings.EqualFold(d.Name(), "node.exe") {
				add(path)
			}
			return nil
		})
		runtimeRoot := filepath.Join(home, ".devnest", "runtimes", "node")
		_ = filepath.WalkDir(runtimeRoot, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			name := strings.ToLower(d.Name())
			if name == "node.exe" || name == "node" {
				add(path)
			}
			return nil
		})
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].Version > out[j].Version
	})
	return out
}

func inspectBinary(binary string) (Installation, bool) {
	cmd := exec.Command(binary, "-v")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return Installation{}, false
	}
	version := strings.TrimSpace(string(out))
	version = strings.TrimPrefix(version, "v")
	if version == "" {
		return Installation{}, false
	}
	npm := npmPathFor(binary)
	return Installation{
		Version:   version,
		Label:     "Node " + version,
		Binary:    binary,
		NPMBinary: npm,
		Installed: true,
	}, true
}

func npmPathFor(nodeBinary string) string {
	dir := filepath.Dir(nodeBinary)
	if runtime.GOOS == "windows" {
		p := filepath.Join(dir, "npm.cmd")
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	p := filepath.Join(dir, "npm")
	if st, err := os.Stat(p); err == nil && !st.IsDir() {
		return p
	}
	if path, err := exec.LookPath("npm"); err == nil {
		return path
	}
	return ""
}

// PickInstallation selects by version or path, else newest.
func PickInstallation(installs []Installation, version, path string) (Installation, bool) {
	if path != "" {
		for _, inst := range installs {
			if filepath.Clean(inst.Binary) == filepath.Clean(path) {
				return inst, true
			}
		}
	}
	if version != "" {
		for _, inst := range installs {
			if inst.Version == version || inst.Label == version || strings.HasPrefix(inst.Version, version) {
				return inst, true
			}
		}
	}
	if len(installs) > 0 {
		return installs[0], true
	}
	return Installation{}, false
}

// ResolveNPM returns npm path for an installation.
func ResolveNPM(inst Installation) string {
	if inst.NPMBinary != "" {
		return inst.NPMBinary
	}
	return npmPathFor(inst.Binary)
}
