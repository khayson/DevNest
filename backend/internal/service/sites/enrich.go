package sites

import (
	"devnest/internal/config"
	"os"
	"path/filepath"
	"strings"
)

const (
	TypeLaravel = "laravel"
	TypeProxy   = "proxy"
)

// SiteView is a site entry enriched for the dashboard.
type SiteView struct {
	config.SiteEntry
	Type             string `json:"type"`
	PathExists       bool   `json:"path_exists"`
	PHPVersion       string `json:"php_version"`
	PHPVersionPinned bool   `json:"php_version_pinned"`
	PHPCGIPort       int    `json:"php_cgi_port,omitempty"`
}

// DetectType returns laravel when public/index.php exists, else proxy.
func DetectType(projectPath string) string {
	if projectPath == "" {
		return TypeProxy
	}
	st, err := os.Stat(filepath.Join(projectPath, "public", "index.php"))
	if err == nil && !st.IsDir() {
		return TypeLaravel
	}
	return TypeProxy
}

// PathExists checks whether the project folder is on disk.
func PathExists(projectPath string) bool {
	if projectPath == "" {
		return false
	}
	st, err := os.Stat(projectPath)
	return err == nil && st.IsDir()
}

// Enrich builds the UI payload for a site.
func Enrich(entry config.SiteEntry, globalPHPVersion string, phpPortForVersion func(string) int) SiteView {
	effectivePHP := strings.TrimSpace(entry.PHPVersion)
	pinned := effectivePHP != ""
	if !pinned {
		effectivePHP = globalPHPVersion
	}

	view := SiteView{
		SiteEntry:        entry,
		Type:             DetectType(entry.Path),
		PathExists:       PathExists(entry.Path),
		PHPVersion:       effectivePHP,
		PHPVersionPinned: pinned,
	}

	if view.Type == TypeLaravel && phpPortForVersion != nil && effectivePHP != "" {
		view.PHPCGIPort = phpPortForVersion(effectivePHP)
	}
	return view
}

// EnrichAll enriches every configured site.
func EnrichAll(entries []config.SiteEntry, globalPHPVersion string, phpPortForVersion func(string) int) []SiteView {
	out := make([]SiteView, len(entries))
	for i, entry := range entries {
		out[i] = Enrich(entry, globalPHPVersion, phpPortForVersion)
	}
	return out
}
