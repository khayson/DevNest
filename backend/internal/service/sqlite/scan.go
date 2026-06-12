package sqlite

import (
	"devnest/internal/config"
	"os"
	"path/filepath"
	"strings"
)

// ScannedDB describes a SQLite file found under a registered site.
type ScannedDB struct {
	SiteName  string `json:"site_name"`
	Domain    string `json:"domain"`
	DBFile    string `json:"db_file"`
	SizeBytes int64  `json:"size_bytes"`
	Path      string `json:"path"`
}

// ScanSites walks registered sites and finds database/database.sqlite files.
func ScanSites(sites []config.SiteEntry) []ScannedDB {
	var out []ScannedDB
	for _, site := range sites {
		if site.Path == "" {
			continue
		}
		dbPath := filepath.Join(site.Path, "database", "database.sqlite")
		info, err := os.Stat(dbPath)
		if err != nil {
			continue
		}
		name := site.Name
		if name == "" {
			name = site.Domain
		}
		out = append(out, ScannedDB{
			SiteName:  name,
			Domain:    site.Domain,
			DBFile:    "database/database.sqlite",
			SizeBytes: info.Size(),
			Path:      dbPath,
		})
	}
	return out
}

// SitePathForDomain returns the project path for a site domain.
func SitePathForDomain(sites []config.SiteEntry, domain string) (string, bool) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	for _, site := range sites {
		if strings.ToLower(site.Domain) == domain {
			return site.Path, true
		}
	}
	return "", false
}
