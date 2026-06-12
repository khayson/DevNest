package stacks

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// DiscoveredBinary is a service binary found inside an install root.
type DiscoveredBinary struct {
	Service string `json:"service"`
	Label   string `json:"label"`
	Path    string `json:"path"`
}

// InstallScan describes binaries and folders found under a root path.
type InstallScan struct {
	ID        string             `json:"id,omitempty"`
	Type      string             `json:"type"`
	Name      string             `json:"name"`
	RootPath  string             `json:"root_path"`
	Binaries  []DiscoveredBinary `json:"binaries"`
	SiteRoots []string           `json:"site_roots,omitempty"`
}

// ScanInstallRoot inspects a folder for XAMPP, Laragon, PostgreSQL, or generic runtimes.
func ScanInstallRoot(root string) InstallScan {
	root = filepath.Clean(root)
	scan := InstallScan{
		RootPath: root,
		Type:     "custom",
		Name:     filepath.Base(root),
	}

	if st, err := os.Stat(root); err != nil || !st.IsDir() {
		return scan
	}

	lower := strings.ToLower(root)

	switch {
	case fileExists(filepath.Join(root, "mysql", "bin", exe("mysqld"))) &&
		fileExists(filepath.Join(root, "apache", "bin", exe("httpd"))):
		scan.Type = "xampp"
		scan.Name = "XAMPP"
		addBinary(&scan, "mysql", "MySQL", filepath.Join(root, "mysql", "bin", exe("mysqld")))
		addBinary(&scan, "php", "PHP", filepath.Join(root, "php", exe("php")))
		if dirExists(filepath.Join(root, "htdocs")) {
			scan.SiteRoots = append(scan.SiteRoots, filepath.Join(root, "htdocs"))
		}

	case fileExists(filepath.Join(root, "laragon.exe")) || dirExists(filepath.Join(root, "bin", "php")):
		scan.Type = "laragon"
		scan.Name = "Laragon"
		scanLaragonBin(&scan, root)
		for _, siteRoot := range []string{"www", filepath.Join("usr", "www")} {
			p := filepath.Join(root, siteRoot)
			if dirExists(p) {
				scan.SiteRoots = append(scan.SiteRoots, p)
			}
		}

	case fileExists(filepath.Join(root, "bin", exe("postgres"))):
		scan.Type = "postgres"
		scan.Name = "PostgreSQL " + filepath.Base(root)
		addBinary(&scan, "postgres", "PostgreSQL", filepath.Join(root, "bin", exe("postgres")))

	default:
		if strings.Contains(lower, "postgresql") || strings.Contains(lower, "postgres") {
			if p := findFile(root, exe("postgres"), 3); p != "" {
				scan.Type = "postgres"
				scan.Name = "PostgreSQL"
				addBinary(&scan, "postgres", "PostgreSQL", p)
			}
		}
		if p := findFile(root, exe("mysqld"), 4); p != "" {
			addBinary(&scan, "mysql", "MySQL", p)
		}
		if p := findFile(root, exe("redis-server"), 4); p != "" {
			addBinary(&scan, "redis", "Redis", p)
		}
		if p := findFile(root, exe("php"), 4); p != "" {
			addBinary(&scan, "php", "PHP", p)
		}
		if p := findFile(root, exe("node"), 4); p != "" {
			addBinary(&scan, "node", "Node.js", p)
		}
	}

	return scan
}

func scanLaragonBin(scan *InstallScan, root string) {
	binRoot := filepath.Join(root, "bin")
	entries, err := os.ReadDir(binRoot)
	if err != nil {
		return
	}
	for _, entry := range entries {
		name := strings.ToLower(entry.Name())
		switch {
		case name == "mysql":
			addFirstBinary(scan, "mysql", "MySQL", filepath.Join(binRoot, entry.Name()), exe("mysqld"))
		case name == "postgresql":
			addFirstBinary(scan, "postgres", "PostgreSQL", filepath.Join(binRoot, entry.Name()), exe("postgres"))
		case name == "php":
			addFirstBinary(scan, "php", "PHP", filepath.Join(binRoot, entry.Name()), exe("php"))
		case name == "nodejs" || name == "node":
			addFirstBinary(scan, "node", "Node.js", filepath.Join(binRoot, entry.Name()), exe("node"))
		case name == "redis":
			addFirstBinary(scan, "redis", "Redis", filepath.Join(binRoot, entry.Name()), exe("redis-server"))
		}
	}
}

func addFirstBinary(scan *InstallScan, service, label, dir, fileName string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		candidate := filepath.Join(dir, entry.Name(), "bin", fileName)
		if fileExists(candidate) {
			addBinary(scan, service, label, candidate)
			return
		}
	}
}

func addBinary(scan *InstallScan, service, label, path string) {
	if !fileExists(path) {
		return
	}
	for _, b := range scan.Binaries {
		if b.Service == service {
			return
		}
	}
	scan.Binaries = append(scan.Binaries, DiscoveredBinary{
		Service: service,
		Label:   label,
		Path:    path,
	})
}

func findFile(root, name string, maxDepth int) string {
	var found string
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || found != "" {
			return nil
		}
		if d.IsDir() {
			rel, _ := filepath.Rel(root, path)
			if rel != "." && strings.Count(rel, string(filepath.Separator)) >= maxDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.EqualFold(d.Name(), name) {
			found = path
		}
		return nil
	})
	return found
}

func exe(name string) string {
	if runtime.GOOS == "windows" && !strings.HasSuffix(strings.ToLower(name), ".exe") {
		return name + ".exe"
	}
	return name
}

func fileExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

func dirExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && st.IsDir()
}

// RuntimePathsFromScan maps discovered binaries to config runtime paths.
func RuntimePathsFromScan(scan InstallScan) map[string]string {
	out := map[string]string{}
	for _, b := range scan.Binaries {
		out[b.Service] = b.Path
	}
	return out
}
