package sites

import (
	"devnest/internal/config"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var appURLRe = regexp.MustCompile(`(?m)^APP_URL=.*$`)

// LinkProject registers the current directory as a site and optionally updates .env APP_URL.
func LinkProject(store *config.Store, projectPath, domain string, updateEnv bool) (config.SiteEntry, error) {
	projectPath = filepath.Clean(projectPath)
	if st, err := os.Stat(projectPath); err != nil || !st.IsDir() {
		return config.SiteEntry{}, err
	}

	if domain == "" {
		domain = config.DomainFromFolderName(filepath.Base(projectPath))
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	if !strings.Contains(domain, ".") {
		domain += ".test"
	}

	siteType, port, ok := detectProject(projectPath)
	if !ok {
		siteType = TypeProxy
		port = 8000
	}
	_ = siteType

	entry := config.SiteEntry{
		Name:   strings.Split(domain, ".")[0],
		Domain: domain,
		Path:   projectPath,
		Port:   port,
		TLS:    true,
	}

	if manifest, err := config.ReadDevnestYml(projectPath); err == nil {
		entry = config.SiteEntryFromDevnestYml(projectPath, manifest)
	}

	if err := store.AddSite(entry); err != nil {
		return config.SiteEntry{}, err
	}

	if updateEnv {
		_ = UpdateEnvAppURL(projectPath, entry.Domain, entry.TLS)
	}

	_ = config.WriteDevnestYml(projectPath, config.DevnestYmlFromSiteEntry(entry))
	return entry, nil
}

// UpdateEnvAppURL sets APP_URL in a Laravel .env file.
func UpdateEnvAppURL(projectPath, domain string, tls bool) error {
	envPath := filepath.Join(projectPath, ".env")
	data, err := os.ReadFile(envPath)
	if err != nil {
		return err
	}
	scheme := "http"
	if tls {
		scheme = "https"
	}
	url := scheme + "://" + domain
	text := string(data)
	if appURLRe.MatchString(text) {
		text = appURLRe.ReplaceAllString(text, "APP_URL="+url)
	} else {
		text = strings.TrimRight(text, "\r\n") + "\nAPP_URL=" + url + "\n"
	}
	return os.WriteFile(envPath, []byte(text), 0600)
}
