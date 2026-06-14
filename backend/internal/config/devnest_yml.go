package config

import (
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

const DevnestYmlName = "devnest.yml"

// DevnestProjectFile is the portable site manifest (Herd-compatible shape).
type DevnestProjectFile struct {
	Name       string   `yaml:"name"`
	Domain     string   `yaml:"domain"`
	PHP        string   `yaml:"php,omitempty"`
	Aliases    []string `yaml:"aliases,omitempty"`
	Group      string   `yaml:"group,omitempty"`
	TLS        *bool    `yaml:"tls,omitempty"`
	Port       int      `yaml:"port,omitempty"`
	Services   []string `yaml:"services,omitempty"`
	ForgeSiteID int     `yaml:"forge_site_id,omitempty"`
}

// ReadDevnestYml loads devnest.yml from a project directory.
func ReadDevnestYml(projectPath string) (DevnestProjectFile, error) {
	var out DevnestProjectFile
	path := filepath.Join(projectPath, DevnestYmlName)
	data, err := os.ReadFile(path)
	if err != nil {
		return out, err
	}
	if err := yaml.Unmarshal(data, &out); err != nil {
		return out, err
	}
	return out, nil
}

// WriteDevnestYml writes devnest.yml into a project directory.
func WriteDevnestYml(projectPath string, file DevnestProjectFile) error {
	data, err := yaml.Marshal(file)
	if err != nil {
		return err
	}
	path := filepath.Join(projectPath, DevnestYmlName)
	return os.WriteFile(path, data, 0644)
}

// SiteEntryFromDevnestYml converts a manifest + path into a SiteEntry.
func SiteEntryFromDevnestYml(projectPath string, file DevnestProjectFile) SiteEntry {
	name := strings.TrimSpace(file.Name)
	domain := strings.TrimSpace(strings.ToLower(file.Domain))
	if domain == "" {
		domain = DomainFromFolderName(filepath.Base(projectPath))
	}
	if name == "" {
		name = strings.Split(domain, ".")[0]
	}
	tls := true
	if file.TLS != nil {
		tls = *file.TLS
	}
	port := file.Port
	if port <= 0 {
		port = 8000
	}
	return normalizeSiteEntry(SiteEntry{
		Name:        name,
		Domain:      domain,
		Path:        filepath.Clean(projectPath),
		Port:        port,
		TLS:         tls,
		PHPVersion:  strings.TrimSpace(file.PHP),
		Aliases:     file.Aliases,
		Group:       file.Group,
		ForgeSiteID: file.ForgeSiteID,
	})
}

// DevnestYmlFromSiteEntry exports a site to manifest form.
func DevnestYmlFromSiteEntry(entry SiteEntry) DevnestProjectFile {
	tls := entry.TLS
	return DevnestProjectFile{
		Name:        entry.Name,
		Domain:      entry.Domain,
		PHP:         entry.PHPVersion,
		Aliases:     entry.Aliases,
		Group:       entry.Group,
		TLS:         &tls,
		Port:        entry.Port,
		ForgeSiteID: entry.ForgeSiteID,
	}
}

// DomainFromFolderName builds a *.test hostname from a folder name.
func DomainFromFolderName(folder string) string {
	s := strings.ToLower(strings.TrimSpace(folder))
	s = strings.ReplaceAll(s, "_", "-")
	s = strings.ReplaceAll(s, " ", "-")
	if s == "" {
		s = "site"
	}
	if !strings.Contains(s, ".") {
		s += ".test"
	}
	return s
}
