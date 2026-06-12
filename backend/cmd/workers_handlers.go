package cmd

import (
	"devnest/internal/config"
	"devnest/internal/service"
	"devnest/internal/service/cron"
	"devnest/internal/service/php"
	"devnest/internal/service/queue"
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

var globalQueueMgr *queue.Manager
var globalCronMgr *cron.Manager

func initWorkerManagers() {
	if globalManager == nil {
		return
	}
	globalQueueMgr = queue.NewManager(
		func(s service.Service) { globalManager.Register(s) },
		func(id string) { globalManager.Unregister(id) },
	)
	globalCronMgr = cron.NewManager(
		func(s service.Service) { globalManager.Register(s) },
		func(id string) { globalManager.Unregister(id) },
	)
	syncWorkerManagers()
}

func phpBinaryForSite(site config.SiteEntry) (string, bool) {
	if cfgStore == nil {
		return "", false
	}
	installs := php.DiscoverInstallations()
	if len(installs) == 0 {
		return "", false
	}
	version := site.PHPVersion
	path := cfgStore.GetActivePHPPath()
	if version != "" {
		path = ""
	}
	inst, ok := php.PickInstallation(installs, version, path)
	if !ok {
		return "", false
	}
	return inst.Binary, true
}

func syncWorkerManagers() {
	if cfgStore == nil {
		return
	}
	sites := cfgStore.GetSites()
	defaults := cfgStore.GetQueueDefaults()
	if globalQueueMgr != nil {
		globalQueueMgr.SyncWorkers(sites, phpBinaryForSite, defaults)
	}
	if globalCronMgr != nil {
		globalCronMgr.SyncSchedulers(sites, phpBinaryForSite)
	}
}

func buildQueueSyncPayload() map[string]interface{} {
	workers := []queue.WorkerView{}
	defaults := config.DefaultQueueWorkerDefaults()
	phpOK := activePHPBinary() != ""

	if cfgStore != nil {
		defaults = cfgStore.GetQueueDefaults()
		if globalQueueMgr != nil {
			workers = globalQueueMgr.ListWorkers(cfgStore.GetSites())
		}
	}

	return map[string]interface{}{
		"workers":       workers,
		"defaults":      defaults,
		"php_available": phpOK,
	}
}

func buildSchedulerSyncPayload() map[string]interface{} {
	schedulers := []cron.SchedulerView{}
	phpOK := activePHPBinary() != ""

	if cfgStore != nil && globalCronMgr != nil {
		schedulers = globalCronMgr.ListSchedulers(cfgStore.GetSites())
	}

	return map[string]interface{}{
		"schedulers":    schedulers,
		"php_available": phpOK,
	}
}

func sendQueueSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event":  "queue_sync",
		"queues": buildQueueSyncPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastQueueSync() {
	broadcastEvent("queue_sync", map[string]interface{}{
		"queues": buildQueueSyncPayload(),
	})
}

func sendSchedulerSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event":     "scheduler_sync",
		"scheduler": buildSchedulerSyncPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastSchedulerSync() {
	broadcastEvent("scheduler_sync", map[string]interface{}{
		"scheduler": buildSchedulerSyncPayload(),
	})
}

func handleStartQueueWorker(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalQueueMgr == nil {
		return
	}
	if err := globalQueueMgr.Start(domain); err != nil {
		log.Printf("[Daemon] start queue worker %s: %v", domain, err)
		broadcastEvent("queue_action_result", map[string]interface{}{
			"domain": domain, "success": false, "message": err.Error(),
		})
	} else {
		broadcastTelemetry()
		broadcastQueueSync()
	}
}

func handleStopQueueWorker(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalQueueMgr == nil {
		return
	}
	if err := globalQueueMgr.Stop(domain); err != nil {
		log.Printf("[Daemon] stop queue worker %s: %v", domain, err)
	}
	broadcastTelemetry()
	broadcastQueueSync()
}

func handleRestartQueueWorker(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalQueueMgr == nil {
		return
	}
	if err := globalQueueMgr.Restart(domain); err != nil {
		log.Printf("[Daemon] restart queue worker %s: %v", domain, err)
	}
	broadcastTelemetry()
	broadcastQueueSync()
}

func handleUpdateQueueConfig(payload map[string]interface{}) {
	if cfgStore == nil {
		return
	}
	def := cfgStore.GetQueueDefaults()
	if v, ok := payload["tries"].(float64); ok {
		def.Tries = int(v)
	}
	if v, ok := payload["timeout"].(float64); ok {
		def.Timeout = int(v)
	}
	if v, ok := payload["memory"].(float64); ok {
		def.Memory = int(v)
	}
	if v, ok := payload["queues"].(string); ok {
		def.Queues = v
	}
	if err := cfgStore.UpdateQueueDefaults(def); err != nil {
		log.Printf("[Daemon] update queue config: %v", err)
		return
	}
	if globalQueueMgr != nil {
		globalQueueMgr.ApplyDefaults(def)
	}
	broadcastTelemetry()
	broadcastQueueSync()
}

func handleStartScheduler(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalCronMgr == nil {
		return
	}
	if err := globalCronMgr.Start(domain); err != nil {
		log.Printf("[Daemon] start scheduler %s: %v", domain, err)
		broadcastEvent("scheduler_action_result", map[string]interface{}{
			"domain": domain, "success": false, "message": err.Error(),
		})
	} else {
		broadcastTelemetry()
		broadcastSchedulerSync()
	}
}

func handleStopScheduler(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalCronMgr == nil {
		return
	}
	if err := globalCronMgr.Stop(domain); err != nil {
		log.Printf("[Daemon] stop scheduler %s: %v", domain, err)
	}
	broadcastTelemetry()
	broadcastSchedulerSync()
}

func handleRestartScheduler(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	if domain == "" || globalCronMgr == nil {
		return
	}
	if err := globalCronMgr.Restart(domain); err != nil {
		log.Printf("[Daemon] restart scheduler %s: %v", domain, err)
	}
	broadcastTelemetry()
	broadcastSchedulerSync()
}

func handleRunScheduleNow(payload map[string]interface{}) {
	domain, _ := payload["domain"].(string)
	result := map[string]interface{}{"domain": domain, "success": false}
	if domain == "" || globalCronMgr == nil {
		result["message"] = "Scheduler not available"
		broadcastEvent("scheduler_action_result", result)
		return
	}
	output, err := globalCronMgr.RunOnce(domain)
	if err != nil {
		result["message"] = err.Error()
		if output != "" {
			result["output"] = output
		}
		broadcastEvent("scheduler_action_result", result)
		return
	}
	result["success"] = true
	result["message"] = "schedule:run completed"
	if output != "" {
		result["output"] = output
	}
	broadcastEvent("scheduler_action_result", result)
}
