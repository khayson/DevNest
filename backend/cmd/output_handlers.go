package cmd

import (
	"devnest/internal/service/processlog"
	"encoding/json"

	"github.com/gorilla/websocket"
)

func initProcessLog() {
	processlog.Init(500, func(line processlog.Line) {
		broadcastEvent("worker_output", map[string]interface{}{
			"line": line,
		})
	})
}

func sendWorkerOutputSync(conn *websocket.Conn) {
	lines := processlog.Global().Snapshot("", "")
	payload, err := json.Marshal(map[string]interface{}{
		"event": "worker_output_sync",
		"lines": lines,
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func handleGetWorkerOutput(payload map[string]interface{}) {
	kind, _ := payload["kind"].(string)
	domain, _ := payload["domain"].(string)
	lines := processlog.Global().Snapshot(kind, domain)
	broadcastEvent("worker_output_sync", map[string]interface{}{
		"lines":  lines,
		"kind":   kind,
		"domain": domain,
	})
}

func handleClearWorkerOutput(payload map[string]interface{}) {
	kind, _ := payload["kind"].(string)
	domain, _ := payload["domain"].(string)
	if kind == "" && domain == "" {
		processlog.Global().Clear("")
	} else {
		processlog.Global().ClearFilter(kind, domain)
	}
	lines := processlog.Global().Snapshot("", "")
	broadcastEvent("worker_output_sync", map[string]interface{}{
		"lines": lines,
	})
}
