package cmd

import (
	"devnest/internal/config"
	osutil "devnest/internal/os"
	"devnest/internal/service"
	"devnest/internal/service/database"
	"devnest/internal/service/meilisearch"
	"devnest/internal/service/minio"
	"devnest/internal/service/php"
	"devnest/internal/service/sites"
	"devnest/internal/tunnel"
	"log"
	"os"
	"path/filepath"
	"sync"
)

var (
	globalTunnelMgr *tunnel.Manager
	tunnelMu        sync.RWMutex
	tunnelURLs      = map[string]string{}
)

func registerExtrasServices() {
	if globalManager == nil {
		return
	}

	home, _ := os.UserHomeDir()
	dataRoot := filepath.Join(home, ".devnest", "data")

	if bin, err := database.ResolveMinIO(); err == nil {
		srv := minio.NewServer(
			bin,
			filepath.Join(dataRoot, "minio"),
			database.DefaultMinIOPort,
			database.DefaultMinIOConsolePort,
		)
		globalManager.Register(srv)
		log.Printf("[Daemon] MinIO binary: %s", bin)
	} else {
		log.Printf("[Daemon] MinIO not registered: %v", err)
	}

	if bin, err := database.ResolveMeilisearch(); err == nil {
		srv := meilisearch.NewServer(
			bin,
			filepath.Join(dataRoot, "meilisearch"),
			database.DefaultMeilisearchPort,
		)
		globalManager.Register(srv)
		log.Printf("[Daemon] Meilisearch binary: %s", bin)
	} else {
		log.Printf("[Daemon] Meilisearch not registered: %v", err)
	}

	if bin, err := database.ResolveCloudflared(); err == nil {
		globalTunnelMgr = tunnel.NewManager(bin)
		log.Printf("[Daemon] Cloudflared binary: %s", bin)
	} else {
		log.Printf("[Daemon] Cloudflared not available for tunnels: %v", err)
	}
}

func tunnelTargetForSite(site config.SiteEntry) (port int, hostHeader string) {
	if sites.DetectType(site.Path) == sites.TypeLaravel {
		return 80, site.Domain
	}
	port = site.Port
	if port <= 0 {
		port = 8000
	}
	return port, ""
}

func handleStartTunnel(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || cfgStore == nil || globalTunnelMgr == nil {
		broadcastTunnelResult(domain, false, "Cloudflared not installed — add cloudflared to PATH or ~/.devnest/runtimes/cloudflared")
		return
	}

	site, ok := cfgStore.GetSite(domain)
	if !ok {
		broadcastTunnelResult(domain, false, "Site not found")
		return
	}

	port, hostHeader := tunnelTargetForSite(site)

	if hostHeader != "" {
		if globalCaddy == nil || !globalCaddy.BinaryAvailable() {
			broadcastTunnelResult(domain, false, "Caddy is not installed — Laravel sites need the reverse proxy on port 80")
			return
		}
		state, _ := globalCaddy.HealthCheck()
		if state != service.StateRunning {
			broadcastTunnelResult(domain, false, "Start Caddy from Services first — the tunnel forwards to Caddy with your site domain")
			return
		}
	}

	err := globalTunnelMgr.StartTunnel(domain, port, hostHeader, func(url string) {
		tunnelMu.Lock()
		tunnelURLs[domain] = url
		tunnelMu.Unlock()
		broadcastTunnelResult(domain, true, url)
		broadcastSites()
	})
	if err != nil {
		broadcastTunnelResult(domain, false, err.Error())
	}
}

func handleStopTunnel(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalTunnelMgr == nil {
		return
	}
	_ = globalTunnelMgr.StopTunnel(domain)
	tunnelMu.Lock()
	delete(tunnelURLs, domain)
	tunnelMu.Unlock()
	broadcastTunnelResult(domain, true, "")
	broadcastSites()
}

func broadcastTunnelResult(domain string, success bool, message string) {
	broadcastEvent("tunnel_result", map[string]interface{}{
		"domain":  domain,
		"success": success,
		"message": message,
	})
}

func tunnelURLForDomain(domain string) string {
	tunnelMu.RLock()
	defer tunnelMu.RUnlock()
	return tunnelURLs[domain]
}

func handleTrustLocalCA() {
	result := map[string]interface{}{
		"success": false,
	}
	if err := osutil.InjectCaddyRootCA(); err != nil {
		result["message"] = err.Error()
	} else {
		result["success"] = true
		result["message"] = "Caddy root certificate added to the system trust store"
	}
	broadcastEvent("trust_ca_result", result)
}

func handleTogglePHPExtension(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	name, _ := payload["name"].(string)
	enable, _ := payload["enable"].(bool)
	if name == "" {
		return
	}

	installs := php.DiscoverInstallations()
	cfg := cfgStore.GetConfig()
	inst, ok := php.PickInstallation(installs, cfg.ActivePHPVersion, cfgStore.GetActivePHPPath())
	if !ok || inst.IniPath == "" {
		log.Println("[Daemon] toggle_php_extension: no active php.ini")
		return
	}

	mgr := php.NewExtensionManager(inst.IniPath)
	if err := mgr.ToggleExtension(name, enable); err != nil {
		log.Printf("[Daemon] toggle_php_extension: %v", err)
		broadcastEvent("php_extension_result", map[string]interface{}{
			"name":    name,
			"success": false,
			"message": err.Error(),
		})
		return
	}

	wasRunning := false
	if globalPHP != nil {
		state, _ := globalPHP.HealthCheck()
		wasRunning = state == service.StateRunning
		if wasRunning {
			_ = globalPHP.Stop()
			_ = globalPHP.Start()
		}
	}
	broadcastPHPSync()
	broadcastEvent("php_extension_result", map[string]interface{}{
		"name":    name,
		"success": true,
		"enabled": enable,
	})
}
