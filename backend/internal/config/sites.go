package config

import "strings"

// SiteEntry describes a local site proxied by Caddy.
type SiteEntry struct {
	Name       string   `json:"name"`
	Domain     string   `json:"domain"`
	Path       string   `json:"path"`
	Port       int      `json:"port"`
	TLS        bool     `json:"tls"`
	PHPVersion string   `json:"pinned_php_version,omitempty"`
	Aliases     []string `json:"aliases,omitempty"`
	Group       string   `json:"group,omitempty"`
	ForgeSiteID int      `json:"forge_site_id,omitempty"`
}

// GetSites returns a copy of registered sites.
func (s *Store) GetSites() []SiteEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]SiteEntry, len(s.data.Sites))
	copy(out, s.data.Sites)
	return out
}

// GetSite returns a site by domain.
func (s *Store) GetSite(domain string) (SiteEntry, bool) {
	domain = strings.TrimSpace(strings.ToLower(domain))
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, site := range s.data.Sites {
		if site.Domain == domain {
			return site, true
		}
	}
	return SiteEntry{}, false
}

func normalizeSiteEntry(entry SiteEntry) SiteEntry {
	entry.Domain = strings.TrimSpace(strings.ToLower(entry.Domain))
	entry.Name = strings.TrimSpace(entry.Name)
	entry.Path = strings.TrimSpace(entry.Path)
	entry.PHPVersion = strings.TrimSpace(entry.PHPVersion)
	entry.Group = strings.TrimSpace(entry.Group)
	if entry.Port <= 0 {
		entry.Port = 8000
	}
	if entry.Name == "" && entry.Domain != "" {
		entry.Name = strings.Split(entry.Domain, ".")[0]
	}
	if len(entry.Aliases) > 0 {
		seen := map[string]bool{entry.Domain: true}
		clean := make([]string, 0, len(entry.Aliases))
		for _, alias := range entry.Aliases {
			alias = strings.TrimSpace(strings.ToLower(alias))
			if alias == "" || seen[alias] {
				continue
			}
			seen[alias] = true
			clean = append(clean, alias)
		}
		entry.Aliases = clean
	}
	return entry
}

// AllDomains returns primary domain plus aliases.
func (e SiteEntry) AllDomains() []string {
	out := []string{e.Domain}
	out = append(out, e.Aliases...)
	return out
}

// AddSite registers or updates a site by domain.
func (s *Store) AddSite(entry SiteEntry) error {
	entry = normalizeSiteEntry(entry)
	if entry.Domain == "" {
		return nil
	}

	s.mu.Lock()
	found := false
	for i, existing := range s.data.Sites {
		if existing.Domain == entry.Domain {
			s.data.Sites[i] = entry
			found = true
			break
		}
	}
	if !found {
		s.data.Sites = append(s.data.Sites, entry)
	}
	if s.data.RegisteredSites == nil {
		s.data.RegisteredSites = make(map[string]string)
	}
	s.data.RegisteredSites[entry.Domain] = entry.Path
	s.mu.Unlock()
	return s.Save()
}

// ToggleSiteTLS flips HTTPS for a site.
func (s *Store) ToggleSiteTLS(domain string) (bool, error) {
	domain = strings.TrimSpace(strings.ToLower(domain))
	s.mu.Lock()
	newTLS := false
	found := false
	for i, site := range s.data.Sites {
		if site.Domain == domain {
			s.data.Sites[i].TLS = !site.TLS
			newTLS = s.data.Sites[i].TLS
			found = true
			break
		}
	}
	s.mu.Unlock()
	if !found {
		return false, nil
	}
	return newTLS, s.Save()
}

// RemoveSite deletes a site by domain.
func (s *Store) RemoveSite(domain string) error {
	domain = strings.TrimSpace(strings.ToLower(domain))
	s.mu.Lock()
	filtered := s.data.Sites[:0]
	for _, site := range s.data.Sites {
		if site.Domain != domain {
			filtered = append(filtered, site)
		}
	}
	s.data.Sites = filtered
	delete(s.data.RegisteredSites, domain)
	s.mu.Unlock()
	return s.Save()
}

// migrateLegacySites converts registered_sites map entries into sites slice.
func (s *Store) migrateLegacySites() {
	if len(s.data.Sites) > 0 {
		return
	}
	for domain, path := range s.data.RegisteredSites {
		name := strings.Split(domain, ".")[0]
		s.data.Sites = append(s.data.Sites, SiteEntry{
			Name:   name,
			Domain: domain,
			Path:   path,
			Port:   8000,
			TLS:    true,
		})
	}
}
