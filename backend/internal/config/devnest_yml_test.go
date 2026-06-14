package config

import (
	"path/filepath"
	"testing"
)

func TestSiteEntryFromDevnestYml(t *testing.T) {
	tlsFalse := false
	file := DevnestProjectFile{
		Name:        "My App",
		Domain:      "my-app.test",
		PHP:         "8.3.21",
		Aliases:     []string{"alias.test"},
		Group:       "work",
		TLS:         &tlsFalse,
		Port:        8080,
		ForgeSiteID: 42,
	}
	entry := SiteEntryFromDevnestYml(`C:\projects\my-app`, file)
	if entry.Domain != "my-app.test" {
		t.Fatalf("domain: got %q", entry.Domain)
	}
	if entry.PHPVersion != "8.3.21" {
		t.Fatalf("php: got %q", entry.PHPVersion)
	}
	if entry.Port != 8080 || entry.TLS {
		t.Fatalf("port/tls: %d %v", entry.Port, entry.TLS)
	}
	if entry.ForgeSiteID != 42 {
		t.Fatalf("forge id: %d", entry.ForgeSiteID)
	}
	if filepath.Base(entry.Path) != "my-app" {
		t.Fatalf("path: %q", entry.Path)
	}
}

func TestDevnestYmlFromSiteEntryRoundTrip(t *testing.T) {
	entry := SiteEntry{
		Name: "demo", Domain: "demo.test", Path: "/tmp/demo",
		Port: 8000, TLS: true, PHPVersion: "8.2.28", ForgeSiteID: 7,
	}
	file := DevnestYmlFromSiteEntry(entry)
	if file.ForgeSiteID != 7 || file.PHP != "8.2.28" {
		t.Fatalf("export mismatch: %+v", file)
	}
}
