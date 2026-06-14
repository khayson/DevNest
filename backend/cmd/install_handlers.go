package cmd

import (
	"devnest/internal/installer"
	"strings"
)

func handleInstallRuntime(payload map[string]interface{}) {
	name, _ := payload["runtime"].(string)
	result, err := installer.Install(name, nil)
	resp := map[string]interface{}{
		"success": err == nil,
		"result":  result,
	}
	if err != nil {
		resp["message"] = err.Error()
	} else {
		resp["catalog"] = installer.Catalog()
		if strings.EqualFold(name, "mariadb") {
			registerExtendedServices()
			broadcastDatabaseSync()
			broadcastAboutSync()
		}
	}
	broadcastEvent("runtime_install_result", resp)
}

func handleRuntimeCatalog() {
	broadcastEvent("runtime_catalog", map[string]interface{}{
		"runtimes": installer.Catalog(),
	})
}
