package cmd

import (
	"devnest/internal/config"
	"devnest/internal/forge"
	osutil "devnest/internal/os"
	"devnest/internal/service"
	"devnest/internal/service/database"
	"devnest/internal/service/mysql"
	"devnest/internal/service/php"
	"devnest/internal/service/redis"
	"devnest/internal/service/rustfs"
	"devnest/internal/service/sites"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var stackFrameRe = regexp.MustCompile(`(?m)(?:#\d+\s+)?([A-Za-z]:\\[^:\n]+|/[^\s:]+\.(?:php|blade\.php)):(\d+)`)

func handleInstallPHP(payload map[string]interface{}) {
	version, _ := payload["version"].(string)
	if version == "" {
		version = "8.3.21"
	}
	result, err := php.InstallWindows(version, nil)
	resp := map[string]interface{}{
		"success": err == nil,
		"result":  result,
	}
	if err != nil {
		resp["message"] = err.Error()
	} else if cfgStore != nil {
		installs := php.DiscoverInstallations()
		for _, inst := range installs {
			if inst.Version == result.Version {
				_ = cfgStore.SetActivePHPPath(inst.Version, inst.Binary)
				break
			}
		}
		broadcastPHPSync()
	}
	broadcastEvent("php_install_result", resp)
}

func handleCreateLaravelProject(payload map[string]interface{}) {
	name, _ := payload["name"].(string)
	parent, _ := payload["parent_dir"].(string)
	starter, _ := payload["starter_kit"].(string)
	autoLink, _ := payload["auto_link"].(bool)
	updateEnv, _ := payload["update_env"].(bool)

	phpBin := activePHPBinary()
	target, err := sites.CreateLaravelProject(sites.CreateProjectOptions{
		ParentDir:  parent,
		Name:       name,
		StarterKit: starter,
		PHPBinary:  phpBin,
	})
	resp := map[string]interface{}{"success": err == nil, "path": target}
	if err != nil {
		resp["message"] = err.Error()
		broadcastEvent("wizard_result", resp)
		return
	}
	if autoLink && cfgStore != nil {
		entry, linkErr := sites.LinkProject(cfgStore, target, "", updateEnv)
		if linkErr == nil {
			resp["site"] = entry
			afterSiteMutation()
		}
	}
	broadcastEvent("wizard_result", resp)
}

func handleImportDevnestYml(payload map[string]interface{}) {
	path, _ := payload["path"].(string)
	if cfgStore == nil || path == "" {
		return
	}
	manifest, err := config.ReadDevnestYml(path)
	if err != nil {
		broadcastEvent("devnest_yml_result", map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	entry := config.SiteEntryFromDevnestYml(path, manifest)
	if err := cfgStore.AddSite(entry); err != nil {
		broadcastEvent("devnest_yml_result", map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	afterSiteMutation()
	broadcastEvent("devnest_yml_result", map[string]interface{}{"success": true, "site": entry})
}

func handleExportDevnestYml(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if cfgStore == nil || domain == "" {
		return
	}
	site, ok := cfgStore.GetSite(domain)
	if !ok {
		broadcastEvent("devnest_yml_result", map[string]interface{}{"success": false, "message": "site not found"})
		return
	}
	if err := config.WriteDevnestYml(site.Path, config.DevnestYmlFromSiteEntry(site)); err != nil {
		broadcastEvent("devnest_yml_result", map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	broadcastEvent("devnest_yml_result", map[string]interface{}{"success": true, "path": filepath.Join(site.Path, config.DevnestYmlName)})
}

func handleUpdateForge(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	settings := cfgStore.GetForge()
	if token, ok := payload["api_token"].(string); ok {
		settings.APIToken = strings.TrimSpace(token)
	}
	if sid, ok := payload["server_id"].(float64); ok {
		settings.ServerID = int(sid)
	}
	if name, ok := payload["server_name"].(string); ok {
		settings.ServerName = strings.TrimSpace(name)
	}
	_ = cfgStore.UpdateForge(settings)
	broadcastEvent("forge_result", map[string]interface{}{"success": true, "forge": settings})
}

func handleForgeDeploy(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	forgeSiteID, _ := payload["forge_site_id"].(float64)
	settings := cfgStore.GetForge()
	client := forge.NewClient(settings.APIToken)
	err := client.DeploySite(settings.ServerID, int(forgeSiteID))
	resp := map[string]interface{}{"success": err == nil}
	if err != nil {
		resp["message"] = err.Error()
	}
	broadcastEvent("forge_result", resp)
}

func handleForgeListSites() {
	if cfgStore == nil {
		return
	}
	settings := cfgStore.GetForge()
	client := forge.NewClient(settings.APIToken)
	list, err := client.ListSites(settings.ServerID)
	resp := map[string]interface{}{"success": err == nil, "sites": list}
	if err != nil {
		resp["message"] = err.Error()
	}
	broadcastEvent("forge_sites_sync", resp)
}

func handleDebugStart(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	port := 9003
	if v, ok := payload["port"].(float64); ok && v > 0 {
		port = int(v)
	}
	ideKey, _ := payload["ide_key"].(string)
	settings := php.DebugSettings{Port: port, IDEKey: ideKey, Enabled: true}
	if err := applyDebugSession(true, settings); err != nil {
		broadcastEvent("debug_result", map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	_ = cfgStore.SetDebugSessionActive(true)
	broadcastPHPSync()
	broadcastEvent("debug_result", map[string]interface{}{"success": true, "active": true, "settings": settings})
}

func handleDebugStop() {
	if cfgStore == nil {
		return
	}
	if err := applyDebugSession(false, php.DebugSettings{}); err != nil {
		broadcastEvent("debug_result", map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	_ = cfgStore.SetDebugSessionActive(false)
	broadcastPHPSync()
	broadcastEvent("debug_result", map[string]interface{}{"success": true, "active": false})
}

func applyDebugSession(enable bool, settings php.DebugSettings) error {
	installs := php.DiscoverInstallations()
	cfg := cfgStore.GetConfig()
	inst, ok := php.PickInstallation(installs, cfg.ActivePHPVersion, cfgStore.GetActivePHPPath())
	if !ok || inst.IniPath == "" {
		return os.ErrNotExist
	}
	if err := php.ConfigureDebugSession(inst.IniPath, enable, settings); err != nil {
		return err
	}
	if globalPHP != nil {
		state, _ := globalPHP.HealthCheck()
		if state == service.StateRunning {
			_ = globalPHP.Stop()
			_ = globalPHP.Start()
		}
	}
	return nil
}

func handleOpenInIDE(payload map[string]interface{}) {
	filePath, _ := payload["file"].(string)
	line := 1
	if v, ok := payload["line"].(float64); ok {
		line = int(v)
	}
	message, _ := payload["message"].(string)
	if filePath == "" && message != "" {
		if m := stackFrameRe.FindStringSubmatch(message); len(m) == 3 {
			filePath = m[1]
			if n, err := parseIntSafe(m[2]); err == nil {
				line = n
			}
		}
	}
	editor := cfgStore.GetIDECommand()
	if custom, ok := payload["editor"].(string); ok && custom != "" {
		editor = custom
	}
	err := osutil.OpenInIDE(editor, filePath, line)
	resp := map[string]interface{}{"success": err == nil, "file": filePath, "line": line}
	if err != nil {
		resp["message"] = err.Error()
	}
	broadcastEvent("ide_open_result", resp)
}

func handleOpenDatabase(payload map[string]interface{}) {
	engine, _ := payload["engine"].(string)
	sqlitePath, _ := payload["sqlite_path"].(string)
	connURL := databaseConnURL(engine)
	if engine == "sqlite" && sqlitePath != "" {
		connURL = "sqlite://" + filepath.ToSlash(sqlitePath)
	}
	err := osutil.OpenTablePlus(connURL)
	resp := map[string]interface{}{"success": err == nil, "url": connURL}
	if err != nil {
		resp["message"] = err.Error()
	}
	broadcastEvent("db_open_result", resp)
}

func databaseConnURL(engine string) string {
	switch engine {
	case "postgres":
		return "postgresql://devnest@127.0.0.1:5432/devnest"
	case "redis", "valkey":
		return "redis://127.0.0.1:6379"
	default:
		return "mysql://root@127.0.0.1:3306/devnest"
	}
}

func handleToggleDumpWatch(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	id, _ := payload["id"].(string)
	watch, _ := payload["watch"].(bool)
	_ = cfgStore.SetDumpWatchIgnored(id, !watch)
	broadcastEvent("dump_watch_sync", map[string]interface{}{
		"ignored": cfgStore.GetConfig().DumpWatchIgnored,
	})
}

func handleCloneService(payload map[string]interface{}) {
	sourceID, _ := payload["source_id"].(string)
	newID, _ := payload["new_id"].(string)
	if sourceID == "" || newID == "" || globalManager == nil {
		return
	}
	srv, ok := globalManager.GetService(sourceID)
	if !ok {
		broadcastEvent("service_clone_result", map[string]interface{}{"success": false, "message": "source service not found"})
		return
	}
	// Clone is metadata-only: copy custom port mapping if present.
	cfg := cfgStore.GetConfig()
	if cfg.CustomPorts == nil {
		cfg.CustomPorts = map[string]int{}
	}
	if port, exists := cfg.CustomPorts[sourceID]; exists {
		cfg.CustomPorts[newID] = port + 1
	}
	_ = cfgStore.Save()
	broadcastEvent("service_clone_result", map[string]interface{}{
		"success":   true,
		"source_id": sourceID,
		"new_id":    newID,
		"note":      "Port mapping cloned — restart daemon to apply cloned service " + srv.Name(),
	})
}

func handleUpdateIDECommand(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	cmdName, _ := payload["command"].(string)
	_ = cfgStore.SetIDECommand(cmdName)
	broadcastEvent("config_update", map[string]interface{}{"config": cfgStore.GetConfig()})
}

func handleLinkSite(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	path, _ := payload["path"].(string)
	domain, _ := payload["domain"].(string)
	updateEnv, _ := payload["update_env"].(bool)
	if path == "" {
		path, _ = os.Getwd()
	}
	entry, err := sites.LinkProject(cfgStore, path, domain, updateEnv)
	resp := map[string]interface{}{"success": err == nil}
	if err != nil {
		resp["message"] = err.Error()
	} else {
		resp["site"] = entry
		afterSiteMutation()
	}
	broadcastEvent("link_result", resp)
}

func parseIntSafe(s string) (int, error) {
	var n int
	err := json.Unmarshal([]byte(s), &n)
	if err == nil {
		return n, nil
	}
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, os.ErrInvalid
		}
		n = n*10 + int(ch-'0')
	}
	return n, nil
}

func registerExtendedServices() {
	if globalManager == nil {
		return
	}
	home, _ := os.UserHomeDir()
	dataRoot := filepath.Join(home, ".devnest", "data")

	if bin, err := database.ResolveMariaDB(); err == nil {
		srv := mysql.NewNamedServer("mariadb", "MariaDB Server", "11", bin, database.DefaultMariaDBPort, "mariadb")
		globalManager.Register(srv)
		log.Printf("[Daemon] MariaDB binary: %s", bin)
	}
	if bin, err := database.ResolveValkey(); err == nil {
		srv := redis.NewNamedServer("valkey", "Valkey Server", "8", bin, database.DefaultValkeyPort, "valkey")
		globalManager.Register(srv)
		log.Printf("[Daemon] Valkey binary: %s", bin)
	}
	if bin, err := database.ResolveRustFS(); err == nil {
		srv := rustfs.NewServer(bin, filepath.Join(dataRoot, "rustfs"), database.DefaultRustFSPort, database.DefaultRustFSConsolePort)
		globalManager.Register(srv)
		log.Printf("[Daemon] RustFS binary: %s", bin)
	}
}
