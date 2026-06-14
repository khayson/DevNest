package osutil

import (
	"devnest/internal/config"
	"log"
)

// SyncSiteDomains writes hosts file entries for every domain on the given sites.
// Returns domains that were newly added.
func SyncSiteDomains(sites []config.SiteEntry) []string {
	hostsPath := getHostsPath()
	var added []string
	for _, site := range sites {
		for _, domain := range site.AllDomains() {
			exists, err := hostExists(hostsPath, domain)
			if err != nil {
				log.Printf("[Hosts] Failed to check %s: %v", domain, err)
				continue
			}
			if exists {
				continue
			}
			if err := AddHostEntry(domain); err != nil {
				log.Printf("[Hosts] Failed to add %s: %v", domain, err)
				continue
			}
			added = append(added, domain)
		}
	}
	return added
}

// RemoveSiteDomains removes hosts entries for a site's primary domain and aliases.
func RemoveSiteDomains(site config.SiteEntry) {
	for _, domain := range site.AllDomains() {
		if err := RemoveHostEntry(domain); err != nil {
			log.Printf("[Hosts] Failed to remove %s: %v", domain, err)
		}
	}
}
