package node

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// ProjectInfo describes a Node frontend project.
type ProjectInfo struct {
	HasPackageJSON bool   `json:"has_package_json"`
	HasDevScript   bool   `json:"has_dev_script"`
	UsesVite       bool   `json:"uses_vite"`
	DevCommand     string `json:"dev_command"`
}

// InspectProject reads package.json for dev/vite scripts.
func InspectProject(projectPath string) ProjectInfo {
	info := ProjectInfo{}
	pkgPath := filepath.Join(projectPath, "package.json")
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		return info
	}
	info.HasPackageJSON = true

	var pkg struct {
		Scripts map[string]string `json:"scripts"`
		DevDeps map[string]string `json:"devDependencies"`
		Deps    map[string]string `json:"dependencies"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return info
	}
	if dev, ok := pkg.Scripts["dev"]; ok && strings.TrimSpace(dev) != "" {
		info.HasDevScript = true
		info.DevCommand = "npm run dev"
	}
	for _, deps := range []map[string]string{pkg.DevDeps, pkg.Deps} {
		for name := range deps {
			if strings.Contains(strings.ToLower(name), "vite") {
				info.UsesVite = true
			}
		}
	}
	if !info.UsesVite && pkg.Scripts["dev"] != "" {
		lower := strings.ToLower(pkg.Scripts["dev"])
		if strings.Contains(lower, "vite") {
			info.UsesVite = true
		}
	}
	return info
}

// IsNodeProject returns true when the site has a runnable dev script.
func IsNodeProject(projectPath string) bool {
	info := InspectProject(projectPath)
	return info.HasPackageJSON && info.HasDevScript
}
