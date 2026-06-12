package sites

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var nonDomainChars = regexp.MustCompile(`[^a-z0-9-]+`)

// DiscoveredSite is a project found under a parked folder root.
type DiscoveredSite struct {
	Name              string `json:"name"`
	Domain            string `json:"domain"`
	Path              string `json:"path"`
	Port              int    `json:"port"`
	Type              string `json:"type"`
	AlreadyRegistered bool   `json:"already_registered"`
}

// ScanParkedPath lists importable projects in immediate subfolders of root.
func ScanParkedPath(root string, existing []string) []DiscoveredSite {
	root = filepath.Clean(root)
	st, err := os.Stat(root)
	if err != nil || !st.IsDir() {
		return nil
	}

	existingDomains := map[string]bool{}
	existingPaths := map[string]bool{}
	for _, item := range existing {
		item = strings.TrimSpace(strings.ToLower(item))
		if strings.Contains(item, string(filepath.Separator)) || strings.Contains(item, "/") {
			existingPaths[filepath.Clean(item)] = true
		} else {
			existingDomains[item] = true
		}
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}

	var out []DiscoveredSite
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if shouldSkipDir(name) {
			continue
		}

		projectPath := filepath.Join(root, name)
		siteType, port, ok := detectProject(projectPath)
		if !ok {
			continue
		}

		domain := DomainFromFolder(name)
		discovered := DiscoveredSite{
			Name:   name,
			Domain: domain,
			Path:   projectPath,
			Port:   port,
			Type:   siteType,
			AlreadyRegistered: existingDomains[domain] ||
				existingPaths[filepath.Clean(projectPath)],
		}
		out = append(out, discovered)
	}
	return out
}

func detectProject(projectPath string) (siteType string, port int, ok bool) {
	artisan := fileExists(filepath.Join(projectPath, "artisan"))
	publicIndex := fileExists(filepath.Join(projectPath, "public", "index.php"))
	composer := fileExists(filepath.Join(projectPath, "composer.json"))

	if (artisan && publicIndex) || (composer && publicIndex) {
		return TypeLaravel, 8000, true
	}

	pkgPath := filepath.Join(projectPath, "package.json")
	if data, err := os.ReadFile(pkgPath); err == nil {
		var pkg struct {
			Scripts map[string]string `json:"scripts"`
		}
		if json.Unmarshal(data, &pkg) == nil && pkg.Scripts["dev"] != "" {
			port := 5173
			if strings.Contains(pkg.Scripts["dev"], "8000") {
				port = 8000
			} else if strings.Contains(pkg.Scripts["dev"], "3000") {
				port = 3000
			}
			return TypeProxy, port, true
		}
	}

	if publicIndex {
		return TypeLaravel, 8000, true
	}

	return "", 0, false
}

func shouldSkipDir(name string) bool {
	lower := strings.ToLower(name)
	if strings.HasPrefix(name, ".") {
		return true
	}
	switch lower {
	case "node_modules", "vendor", "storage", "bootstrap", "tests":
		return true
	}
	return false
}

// DomainFromFolder builds a *.test hostname from a folder name.
func DomainFromFolder(folder string) string {
	s := strings.ToLower(strings.TrimSpace(folder))
	s = strings.ReplaceAll(s, "_", "-")
	s = strings.ReplaceAll(s, " ", "-")
	s = nonDomainChars.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "site"
	}
	if !strings.Contains(s, ".") {
		s += ".test"
	}
	return s
}

func fileExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

// SuggestedParkedPaths returns common local web roots when they exist.
func SuggestedParkedPaths() []string {
	candidates := []string{
		filepath.Join("C:", "xampp", "htdocs"),
		filepath.Join("C:", "laragon", "www"),
		filepath.Join("C:", "laragon", "usr", "www"),
	}
	var out []string
	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && st.IsDir() {
			out = append(out, p)
		}
	}
	return out
}
