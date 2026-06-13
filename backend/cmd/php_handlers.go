package cmd

import (
	"devnest/internal/service"
	"devnest/internal/service/php"
	"encoding/json"
	"log"
	"path/filepath"

	"github.com/gorilla/websocket"
)

var globalPHP *php.Server
var globalPHPPool *php.Pool
var phpAvailable bool

func registerPHPService() {
	installs := php.DiscoverInstallations()
	if len(installs) == 0 {
		phpAvailable = false
		log.Println("[Daemon] PHP not registered: no php or php-cgi found on PATH or in ~/.devnest/runtimes/php")
		return
	}

	phpAvailable = true
	globalPHPPool = php.NewPool(php.DefaultCGIPort, func(srv *php.Server) {
		if globalManager != nil {
			globalManager.Register(srv)
		}
	})
	syncPHPPoolFromSites(false)
}

func syncPHPPoolFromSites(autostart bool) {
	if globalPHPPool == nil || cfgStore == nil {
		return
	}

	installs := php.DiscoverInstallations()
	if len(installs) == 0 {
		phpAvailable = false
		return
	}
	phpAvailable = true

	cfg := cfgStore.GetConfig()
	primary, ok := php.PickInstallation(installs, cfg.ActivePHPVersion, cfgStore.GetActivePHPPath())
	if !ok {
		return
	}

	if cfgStore.GetActivePHPPath() == "" {
		if err := cfgStore.SetActivePHPPath(primary.Version, primary.Binary); err != nil {
			log.Printf("[Daemon] Failed to persist active PHP: %v", err)
		}
	}

	applyPersistedPHPIni(primary.IniPath)

	srv, err := globalPHPPool.EnsurePrimary(primary, autostart)
	if err != nil {
		log.Printf("[Daemon] Primary PHP setup failed: %v", err)
	}
	globalPHP = srv

	seen := map[string]bool{primary.Version: true}
	for _, site := range cfgStore.GetSites() {
		if site.PHPVersion == "" {
			continue
		}
		pinned, ok := php.PickInstallation(installs, site.PHPVersion, "")
		if !ok || seen[pinned.Version] {
			continue
		}
		seen[pinned.Version] = true
		if _, err := globalPHPPool.EnsurePinned(pinned, autostart); err != nil {
			log.Printf("[Daemon] Pinned PHP %s failed: %v", pinned.Label, err)
		}
	}
}

func applyPersistedPHPIni(iniPath string) {
	if iniPath == "" || cfgStore == nil {
		return
	}
	directives := cfgStore.GetPHPIniDirectives()
	if len(directives) == 0 {
		return
	}
	mgr := php.NewExtensionManager(iniPath)
	for key, value := range directives {
		if err := mgr.SetINIValue(key, value); err != nil {
			log.Printf("[Daemon] Failed to apply php.ini %s: %v", key, err)
		}
	}
}

func buildPHPSyncPayload() map[string]interface{} {
	installs := php.DiscoverInstallations()
	payload := map[string]interface{}{
		"installations": installs,
		"php_available": len(installs) > 0,
		"cgi_port":      php.DefaultCGIPort,
		"directives": map[string]string{
			"memory_limit":        "128M",
			"max_execution_time":  "30",
			"upload_max_filesize": "2M",
		},
	}

	if len(installs) == 0 || cfgStore == nil {
		return payload
	}

	cfg := cfgStore.GetConfig()
	inst, ok := php.PickInstallation(installs, cfg.ActivePHPVersion, cfgStore.GetActivePHPPath())
	if !ok {
		return payload
	}

	payload["active_version"] = inst.Version
	payload["active_label"] = inst.Label
	payload["active_path"] = inst.Binary
	payload["ini_path"] = inst.IniPath
	payload["directives"] = php.ReadDirectives(inst.IniPath)
	payload["extensions"] = php.ExtensionStates(inst.IniPath)
	return payload
}

func sendPHPSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event": "php_sync",
		"php":   buildPHPSyncPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastPHPSync() {
	broadcastEvent("php_sync", map[string]interface{}{
		"php": buildPHPSyncPayload(),
	})
}

func restartPHPService(inst php.Installation) {
	if globalPHPPool == nil || globalManager == nil {
		return
	}

	wasRunning := false
	if globalPHP != nil {
		state, _ := globalPHP.HealthCheck()
		wasRunning = state == service.StateRunning
	}

	applyPersistedPHPIni(inst.IniPath)
	srv, err := globalPHPPool.EnsurePrimary(inst, wasRunning)
	if err != nil {
		log.Printf("[Daemon] PHP restart error: %v", err)
	}
	globalPHP = srv
	syncPHPPoolFromSites(wasRunning)
	broadcastTelemetry()
}

func findPHPInstallation(installs []php.Installation, path, version string) (php.Installation, bool) {
	if path != "" {
		for _, inst := range installs {
			if filepath.Clean(inst.Binary) == filepath.Clean(path) ||
				filepath.Clean(inst.CGIPath) == filepath.Clean(path) {
				return inst, true
			}
		}
	}
	if version != "" {
		for _, inst := range installs {
			if inst.Version == version || inst.Label == version {
				return inst, true
			}
		}
	}
	return php.Installation{}, false
}

func handleSetActivePHP(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	path, _ := payload["path"].(string)
	version, _ := payload["version"].(string)
	installs := php.DiscoverInstallations()
	inst, ok := findPHPInstallation(installs, path, version)
	if !ok {
		log.Printf("[Daemon] set_active_php: installation not found (path=%s version=%s)", path, version)
		return
	}
	if err := cfgStore.SetActivePHPPath(inst.Version, inst.Binary); err != nil {
		log.Printf("[Daemon] Failed to set active PHP: %v", err)
		return
	}
	restartPHPService(inst)
	reloadCaddyIfRunning()
	refreshSQLiteManager()
	syncWorkerManagers()
	broadcastPHPSync()
	broadcastDatabaseSync()
	broadcastQueueSync()
	broadcastSchedulerSync()
	broadcastAboutSync()
}

func handleUpdatePHPIni(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	installs := php.DiscoverInstallations()
	cfg := cfgStore.GetConfig()
	inst, ok := php.PickInstallation(installs, cfg.ActivePHPVersion, cfgStore.GetActivePHPPath())
	if !ok || inst.IniPath == "" {
		log.Println("[Daemon] update_php_ini: no active PHP with php.ini")
		return
	}

	keys := []string{"memory_limit", "max_execution_time", "upload_max_filesize"}
	updates := map[string]string{}
	mgr := php.NewExtensionManager(inst.IniPath)
	for _, key := range keys {
		if raw, ok := payload[key]; ok {
			val, isStr := raw.(string)
			if !isStr || val == "" {
				continue
			}
			if err := mgr.SetINIValue(key, val); err != nil {
				log.Printf("[Daemon] Failed to update php.ini %s: %v", key, err)
				continue
			}
			updates[key] = val
		}
	}
	if len(updates) > 0 {
		if err := cfgStore.UpdatePHPIniDirectives(updates); err != nil {
			log.Printf("[Daemon] Failed to persist php.ini directives: %v", err)
		}
	}

	wasRunning := false
	if globalPHP != nil {
		state, _ := globalPHP.HealthCheck()
		wasRunning = state == service.StateRunning
		if wasRunning {
			_ = globalPHP.Stop()
			if err := globalPHP.Start(); err != nil {
				log.Printf("[Daemon] PHP reload after ini change: %v", err)
			}
			broadcastTelemetry()
		}
	}
	broadcastPHPSync()
}
