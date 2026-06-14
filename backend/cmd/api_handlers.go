package cmd

import (
	"encoding/json"
	"net/http"
	"strings"
)

var requestDaemonShutdown func()

func registerAPIRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/services", handleAPIServices)
	mux.HandleFunc("/api/services/", handleAPIServiceAction)
	mux.HandleFunc("/api/info", handleAPIInfo)
	mux.HandleFunc("/api/shutdown", handleAPIShutdown)
}

func handleAPIShutdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, map[string]interface{}{"ok": true, "message": "shutting down"})
	if requestDaemonShutdown != nil {
		go requestDaemonShutdown()
	}
}

func handleAPIInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, map[string]interface{}{
		"name":    "devnest",
		"version": "1.0.0",
		"launcher": "http://127.0.0.1:9089",
		"mcp": map[string]interface{}{
			"http":     "http://127.0.0.1:9090/mcp",
			"stdio":    "devnest mcp",
			"tools":    []string{"list_sites", "link_site", "start_service"},
			"cursor_config": map[string]interface{}{
				"mcpServers": map[string]interface{}{
					"devnest": map[string]interface{}{
						"command": "devnest",
						"args":    []string{"mcp"},
					},
				},
			},
		},
		"websocket": "ws://127.0.0.1:9090/ws",
	})
}

func handleAPIServices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if globalManager == nil {
		writeJSON(w, map[string]interface{}{"services": []interface{}{}})
		return
	}
	type svc struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		State string `json:"state"`
	}
	out := make([]svc, 0)
	for _, id := range knownServiceIDs() {
		s, ok := globalManager.GetService(id)
		if !ok {
			continue
		}
		state, _ := s.HealthCheck()
		out = append(out, svc{ID: id, Name: s.Name(), State: string(state)})
	}
	writeJSON(w, map[string]interface{}{"services": out})
}

func handleAPIServiceAction(w http.ResponseWriter, r *http.Request) {
	if globalManager == nil {
		http.Error(w, "daemon not ready", http.StatusServiceUnavailable)
		return
	}
	// /api/services/{id}/{action}
	path := strings.TrimPrefix(r.URL.Path, "/api/services/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 {
		http.Error(w, "use /api/services/{id}/start|stop|restart", http.StatusBadRequest)
		return
	}
	id := uiToBackend(parts[0])
	if id == "" {
		id = parts[0]
	}
	action := parts[1]
	srv, ok := globalManager.GetService(id)
	if !ok {
		http.Error(w, "service not found", http.StatusNotFound)
		return
	}
	var err error
	switch r.Method {
	case http.MethodPost:
		switch action {
		case "start":
			err = srv.Start()
		case "stop":
			err = srv.Stop()
		case "restart":
			_ = srv.Stop()
			err = srv.Start()
		default:
			http.Error(w, "unknown action", http.StatusBadRequest)
			return
		}
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	state, _ := srv.HealthCheck()
	resp := map[string]interface{}{
		"id":      parts[0],
		"action":  action,
		"success": err == nil,
		"state":   string(state),
	}
	if err != nil {
		resp["error"] = err.Error()
	}
	writeJSON(w, resp)
}

func knownServiceIDs() []string {
	return []string{
		"dns-resolver", "embedded-smtp", "embedded-dump-server", "caddy-proxy", "php-cgi",
		"mysql", "mariadb", "postgres", "redis", "valkey", "minio", "meilisearch", "rustfs",
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
