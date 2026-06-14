package cmd

import (
	"devnest/internal/service/sites"
	"encoding/json"
	"io"
	"net/http"
)

// Minimal MCP-compatible JSON-RPC endpoint for AI clients.
func handleMCP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var req struct {
		JSONRPC string                 `json:"jsonrpc"`
		ID      interface{}            `json:"id"`
		Method  string                 `json:"method"`
		Params  map[string]interface{} `json:"params"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      req.ID,
	}

	switch req.Method {
	case "initialize":
		resp["result"] = map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"serverInfo": map[string]string{
				"name":    "devnest",
				"version": "1.0.0",
			},
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{},
			},
		}
	case "tools/list":
		resp["result"] = map[string]interface{}{
			"tools": []map[string]interface{}{
				{"name": "list_sites", "description": "List all DevNest local sites", "inputSchema": map[string]string{"type": "object"}},
				{"name": "link_site", "description": "Link current or given folder as a *.test site", "inputSchema": map[string]string{"type": "object"}},
				{"name": "start_service", "description": "Start a DevNest service by id", "inputSchema": map[string]string{"type": "object"}},
			},
		}
	case "tools/call":
		toolName, _ := req.Params["name"].(string)
		args, _ := req.Params["arguments"].(map[string]interface{})
		result := mcpToolCall(toolName, args)
		resp["result"] = result
	default:
		resp["error"] = map[string]interface{}{"code": -32601, "message": "method not found"}
	}

	_ = json.NewEncoder(w).Encode(resp)
}

func mcpToolCall(name string, args map[string]interface{}) map[string]interface{} {
	switch name {
	case "list_sites":
		if cfgStore == nil {
			return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": "daemon config unavailable"}}}
		}
		sites := cfgStore.GetSites()
		data, _ := json.MarshalIndent(sites, "", "  ")
		return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": string(data)}}}
	case "link_site":
		path, _ := args["path"].(string)
		domain, _ := args["domain"].(string)
		if cfgStore == nil {
			return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": "config unavailable"}}}
		}
		entry, err := sitesLinkForMCP(path, domain)
		if err != nil {
			return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": err.Error()}}, "isError": true}
		}
		data, _ := json.Marshal(entry)
		return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": string(data)}}}
	case "start_service":
		id, _ := args["service_id"].(string)
		if globalManager == nil || id == "" {
			return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": "service unavailable"}}}
		}
		srv, ok := globalManager.GetService(id)
		if !ok {
			return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": "service not found"}}, "isError": true}
		}
		err := srv.Start()
		if err != nil {
			return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": err.Error()}}, "isError": true}
		}
		return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": "started " + id}}}
	default:
		return map[string]interface{}{"content": []map[string]string{{"type": "text", "text": "unknown tool"}}, "isError": true}
	}
}

func sitesLinkForMCP(path, domain string) (interface{}, error) {
	return sites.LinkProject(cfgStore, path, domain, true)
}
