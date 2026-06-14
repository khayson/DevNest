package cmd

import (
	"devnest/internal/service"
	osutil "devnest/internal/os"
	"log"
)

func activateHostsFallback(reason string) {
	if cfgStore == nil {
		return
	}
	if cfgStore.GetConfig().DNSUseHostsFallback {
		syncHostsFromSites()
		return
	}
	if err := cfgStore.SetDNSUseHostsFallback(true); err != nil {
		log.Printf("[Hosts] Failed to persist fallback flag: %v", err)
	}
	log.Printf("[Hosts] DNS unavailable (%s) — using system hosts file for *.test domains", reason)
	added := syncHostsFromSites()
	if len(added) > 0 {
		log.Printf("[Hosts] Added %d domain(s) to hosts file", len(added))
	}
	broadcastEvent("config_update", map[string]interface{}{"config": cfgStore.GetConfig()})
	broadcastEvent("hosts_fallback", map[string]interface{}{
		"active":  true,
		"reason":  reason,
		"domains": added,
	})
}

func syncHostsFromSites() []string {
	if cfgStore == nil || !cfgStore.GetConfig().DNSUseHostsFallback {
		return nil
	}
	return osutil.SyncSiteDomains(cfgStore.GetSites())
}

func syncHostsIfNeeded() {
	if cfgStore != nil && cfgStore.GetConfig().DNSUseHostsFallback {
		syncHostsFromSites()
	}
}

func handleEnableHostsFallback() {
	if cfgStore == nil {
		broadcastEvent("hosts_fallback_result", map[string]interface{}{
			"success": false,
			"message": "config store unavailable",
		})
		return
	}
	activateHostsFallback("user authorized in onboarding")
	broadcastEvent("hosts_fallback_result", map[string]interface{}{
		"success": true,
		"message": "Hosts file sync enabled for *.test domains",
	})
}

func ensureDNSOrHostsFallback() {
	if globalManager == nil {
		return
	}
	srv, ok := globalManager.GetService("dns-resolver")
	if !ok {
		return
	}
	state, _ := srv.HealthCheck()
	if state != service.StateRunning {
		activateHostsFallback("dns resolver not running")
	}
}
