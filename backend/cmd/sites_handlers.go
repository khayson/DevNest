package cmd

import (
	"devnest/internal/config"
	osutil "devnest/internal/os"
	"devnest/internal/service/php"
	"devnest/internal/service/sites"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

func getGlobalPHPVersion() string {
	if cfgStore == nil {
		return ""
	}
	cfg := cfgStore.GetConfig()
	if cfg.ActivePHPVersion != "" {
		return cfg.ActivePHPVersion
	}
	installs := php.DiscoverInstallations()
	if inst, ok := php.PickInstallation(installs, "", cfgStore.GetActivePHPPath()); ok {
		return inst.Version
	}
	return ""
}

func phpPortForVersion(version string) int {
	if version == "" {
		return php.DefaultCGIPort
	}
	if globalPHPPool != nil {
		if port := globalPHPPool.PortFor(version); port > 0 {
			return port
		}
	}
	return php.DefaultCGIPort
}

func phpPortForSite(site config.SiteEntry) int {
	version := site.PHPVersion
	if version == "" {
		version = getGlobalPHPVersion()
	}
	return phpPortForVersion(version)
}

func buildEnrichedSites() []sites.SiteView {
	if cfgStore == nil {
		return []sites.SiteView{}
	}
	views := sites.EnrichAll(cfgStore.GetSites(), getGlobalPHPVersion(), phpPortForVersion)
	for i := range views {
		views[i].TunnelURL = tunnelURLForDomain(views[i].Domain)
	}
	return views
}

func existingSiteKeys() []string {
	if cfgStore == nil {
		return nil
	}
	var keys []string
	for _, site := range cfgStore.GetSites() {
		keys = append(keys, strings.ToLower(site.Domain))
		keys = append(keys, site.Path)
	}
	return keys
}

func buildSitesSyncPayload() map[string]interface{} {
	caddyAvailable := globalCaddy != nil && globalCaddy.BinaryAvailable()
	payload := map[string]interface{}{
		"sites":           buildEnrichedSites(),
		"caddy_available": caddyAvailable,
	}
	if cfgStore != nil {
		payload["parked_paths"] = cfgStore.GetParkedPaths()
	}
	payload["suggested_parked_paths"] = sites.SuggestedParkedPaths()
	return payload
}

func sendSitesSync(conn *websocket.Conn) {
	if cfgStore == nil {
		return
	}
	data := buildSitesSyncPayload()
	data["event"] = "sites_sync"
	payload, err := json.Marshal(data)
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastSites() {
	if cfgStore == nil {
		return
	}
	broadcastEvent("sites_sync", buildSitesSyncPayload())
}

func afterSiteMutation() {
	syncPHPPoolFromSites(false)
	refreshSQLiteManager()
	syncWorkerManagers()
	syncNodeManagers()
	reloadCaddyIfRunning()
	refreshLogSources()
	syncHostsIfNeeded()
	broadcastSites()
	broadcastDatabaseSync()
	broadcastQueueSync()
	broadcastSchedulerSync()
	broadcastNodeSync()
	broadcastAboutSync()
	if cfgStore != nil {
		broadcastEvent("config_update", map[string]interface{}{"config": cfgStore.GetConfig()})
	}
}

func handleUpdateSite(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	entry, ok := parseSitePayload(payload)
	if !ok {
		return
	}
	if err := cfgStore.AddSite(entry); err != nil {
		log.Printf("[Daemon] Error updating site: %v", err)
		return
	}
	afterSiteMutation()
}

func handleToggleSiteTLS(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	domain, _ := payload["domain"].(string)
	if domain == "" {
		return
	}
	if _, err := cfgStore.ToggleSiteTLS(domain); err != nil {
		log.Printf("[Daemon] Error toggling site TLS: %v", err)
		return
	}
	afterSiteMutation()
}

func handleOpenPath(payload map[string]interface{}) {
	path, _ := payload["path"].(string)
	if path == "" {
		return
	}
	if err := osutil.OpenPath(path); err != nil {
		log.Printf("[Daemon] Error opening path %s: %v", path, err)
	}
}

func handleScanParkedPath(payload map[string]interface{}) {
	root, _ := payload["path"].(string)
	root = strings.TrimSpace(root)
	result := map[string]interface{}{
		"path":  root,
		"sites": []sites.DiscoveredSite{},
	}
	if root != "" {
		result["sites"] = sites.ScanParkedPath(root, existingSiteKeys())
	}
	broadcastEvent("parked_scan_result", result)
}

func importDiscoveredSites(discovered []sites.DiscoveredSite, onlyNew bool) int {
	if cfgStore == nil {
		return 0
	}
	imported := 0
	for _, d := range discovered {
		if onlyNew && d.AlreadyRegistered {
			continue
		}
		if onlyNew {
			if _, ok := cfgStore.GetSite(d.Domain); ok {
				continue
			}
			duplicatePath := false
			for _, existing := range cfgStore.GetSites() {
				if existing.Path == d.Path {
					duplicatePath = true
					break
				}
			}
			if duplicatePath {
				continue
			}
		}
		entry := siteEntryFromDiscovered(d)
		if err := cfgStore.AddSite(entry); err != nil {
			log.Printf("[Sites] Failed to import %s: %v", d.Domain, err)
			continue
		}
		imported++
	}
	return imported
}

func handleAddParkedPath(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	root, _ := payload["path"].(string)
	name, _ := payload["name"].(string)
	importSites, _ := payload["import_sites"].(bool)
	root = strings.TrimSpace(root)
	if root == "" {
		return
	}

	entry := config.ParkedPath{
		ID:   "parked-" + time.Now().Format("20060102150405"),
		Name: strings.TrimSpace(name),
		Path: root,
	}
	if err := cfgStore.AddParkedPath(entry); err != nil {
		log.Printf("[Sites] Failed to save parked path: %v", err)
		return
	}

	imported := 0
	if importSites {
		discovered := sites.ScanParkedPath(root, existingSiteKeys())
		imported = importDiscoveredSites(discovered, true)
		if imported > 0 {
			afterSiteMutation()
		} else {
			broadcastSites()
		}
	} else {
		broadcastSites()
	}

	log.Printf("[Sites] Parked folder %s — imported %d site(s)", root, imported)
}

func handleRemoveParkedPath(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	id, _ := payload["id"].(string)
	if id == "" {
		return
	}
	if err := cfgStore.RemoveParkedPath(id); err != nil {
		log.Printf("[Sites] Failed to remove parked path: %v", err)
		return
	}
	broadcastSites()
}

func handleRescanParkedPaths() {
	if cfgStore == nil {
		return
	}
	imported := 0
	for _, parked := range cfgStore.GetParkedPaths() {
		discovered := sites.ScanParkedPath(parked.Path, existingSiteKeys())
		imported += importDiscoveredSites(discovered, true)
	}
	if imported > 0 {
		afterSiteMutation()
	} else {
		broadcastSites()
	}
	log.Printf("[Sites] Rescan complete — imported %d new site(s)", imported)
}

func handleImportDiscoveredSites(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	raw, ok := payload["sites"].([]interface{})
	if !ok || len(raw) == 0 {
		return
	}

	var discovered []sites.DiscoveredSite
	for _, item := range raw {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		d := sites.DiscoveredSite{
			Name:   stringField(m, "name"),
			Domain: stringField(m, "domain"),
			Path:   stringField(m, "path"),
			Type:   stringField(m, "type"),
		}
		if v, ok := m["port"].(float64); ok {
			d.Port = int(v)
		}
		if d.Domain == "" || d.Path == "" {
			continue
		}
		d.AlreadyRegistered = false
		discovered = append(discovered, d)
	}

	imported := importDiscoveredSites(discovered, true)
	if imported > 0 {
		afterSiteMutation()
	}
}

func stringField(m map[string]interface{}, key string) string {
	v, _ := m[key].(string)
	return strings.TrimSpace(v)
}

func siteEntryFromDiscovered(d sites.DiscoveredSite) config.SiteEntry {
	if manifest, err := config.ReadDevnestYml(d.Path); err == nil {
		return config.SiteEntryFromDevnestYml(d.Path, manifest)
	}
	return config.SiteEntry{
		Name:   d.Name,
		Domain: d.Domain,
		Path:   d.Path,
		Port:   d.Port,
		TLS:    true,
	}
}

func syncParkedPathsOnStartup() int {
	if cfgStore == nil || len(cfgStore.GetParkedPaths()) == 0 {
		return 0
	}
	imported := 0
	for _, parked := range cfgStore.GetParkedPaths() {
		discovered := sites.ScanParkedPath(parked.Path, existingSiteKeys())
		imported += importDiscoveredSites(discovered, true)
	}
	if imported > 0 {
		log.Printf("[Sites] Startup scan imported %d site(s) from parked folders", imported)
	}
	return imported
}
