package cmd

import (
	"devnest/internal/service"
	"devnest/internal/service/node"
	"encoding/json"
	"log"
	"path/filepath"

	"github.com/gorilla/websocket"
)

var globalNodeMgr *node.Manager

func initNodeManager() {
	if globalManager == nil {
		return
	}
	globalNodeMgr = node.NewManager(
		func(s service.Service) { globalManager.Register(s) },
		func(id string) { globalManager.Unregister(id) },
	)
	syncNodeManagers()
}

func syncNodeManagers() {
	if globalNodeMgr == nil || cfgStore == nil {
		return
	}
	installs := node.DiscoverInstallations()
	if len(installs) == 0 {
		return
	}
	cfg := cfgStore.GetConfig()
	inst, ok := node.PickInstallation(installs, cfg.ActiveNodeVersion, cfgStore.GetActiveNodePath())
	if !ok {
		return
	}
	if cfgStore.GetActiveNodePath() == "" {
		_ = cfgStore.SetActiveNodePath(inst.Version, inst.Binary)
	}
	globalNodeMgr.SyncServers(cfgStore.GetSites(), inst)
}

func buildNodeSyncPayload() map[string]interface{} {
	installs := node.DiscoverInstallations()
	payload := map[string]interface{}{
		"installations": installs,
		"node_available": len(installs) > 0,
		"servers":       []node.DevServerView{},
	}

	if len(installs) == 0 || cfgStore == nil {
		return payload
	}

	cfg := cfgStore.GetConfig()
	inst, ok := node.PickInstallation(installs, cfg.ActiveNodeVersion, cfgStore.GetActiveNodePath())
	if ok {
		payload["active_version"] = inst.Version
		payload["active_label"] = inst.Label
		payload["active_path"] = inst.Binary
		payload["npm_path"] = node.ResolveNPM(inst)
	}
	if globalNodeMgr != nil {
		payload["servers"] = globalNodeMgr.ListServers(cfgStore.GetSites())
	}
	return payload
}

func sendNodeSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event": "node_sync",
		"node":  buildNodeSyncPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastNodeSync() {
	broadcastEvent("node_sync", map[string]interface{}{
		"node": buildNodeSyncPayload(),
	})
}

func handleSetActiveNode(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	path, _ := payload["path"].(string)
	version, _ := payload["version"].(string)
	installs := node.DiscoverInstallations()
	var inst node.Installation
	found := false
	if path != "" {
		for _, i := range installs {
			if filepath.Clean(i.Binary) == filepath.Clean(path) {
				inst = i
				found = true
				break
			}
		}
	}
	if !found && version != "" {
		inst, found = node.PickInstallation(installs, version, "")
	}
	if !found {
		log.Printf("[Daemon] set_active_node: not found path=%s version=%s", path, version)
		return
	}
	if err := cfgStore.SetActiveNodePath(inst.Version, inst.Binary); err != nil {
		log.Printf("[Daemon] set_active_node: %v", err)
		return
	}
	if globalNodeMgr != nil {
		globalNodeMgr.ApplyInstallation(inst)
	}
	syncNodeManagers()
	broadcastNodeSync()
	broadcastTelemetry()
}

func handleStartNodeDev(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalNodeMgr == nil {
		return
	}
	if err := globalNodeMgr.Start(domain); err != nil {
		log.Printf("[Daemon] start node dev %s: %v", domain, err)
	} else {
		broadcastTelemetry()
		broadcastNodeSync()
	}
}

func handleStopNodeDev(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalNodeMgr == nil {
		return
	}
	if err := globalNodeMgr.Stop(domain); err != nil {
		log.Printf("[Daemon] stop node dev %s: %v", domain, err)
	}
	broadcastTelemetry()
	broadcastNodeSync()
}

func handleRestartNodeDev(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalNodeMgr == nil {
		return
	}
	if err := globalNodeMgr.Restart(domain); err != nil {
		log.Printf("[Daemon] restart node dev %s: %v", domain, err)
	}
	broadcastTelemetry()
	broadcastNodeSync()
}
