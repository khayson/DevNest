package cmd

import (
	"devnest/internal/config"
	osutil "devnest/internal/os"
	"devnest/internal/service/php"
	"devnest/internal/service/sites"
	"encoding/json"
	"log"

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
	return sites.EnrichAll(cfgStore.GetSites(), getGlobalPHPVersion(), phpPortForVersion)
}

func sendSitesSync(conn *websocket.Conn) {
	if cfgStore == nil {
		return
	}
	caddyAvailable := globalCaddy != nil && globalCaddy.BinaryAvailable()
	payload, err := json.Marshal(map[string]interface{}{
		"event":           "sites_sync",
		"sites":           buildEnrichedSites(),
		"caddy_available": caddyAvailable,
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastSites() {
	if cfgStore == nil {
		return
	}
	broadcastEvent("sites_sync", map[string]interface{}{
		"sites":           buildEnrichedSites(),
		"caddy_available": globalCaddy != nil && globalCaddy.BinaryAvailable(),
	})
}

func afterSiteMutation() {
	syncPHPPoolFromSites(false)
	refreshSQLiteManager()
	reloadCaddyIfRunning()
	refreshLogSources()
	broadcastSites()
	broadcastDatabaseSync()
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
