package cmd

import (
	"bufio"
	"devnest/internal/config"
	"devnest/internal/service/sites"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
)

// mcpStdioCmd speaks MCP JSON-RPC over stdin/stdout for Cursor and other IDEs.
var mcpStdioCmd = &cobra.Command{
	Use:   "mcp",
	Short: "Run DevNest as an MCP server over stdio (for Cursor / Claude Desktop)",
	RunE: func(cmd *cobra.Command, args []string) error {
		store, err := config.NewStore()
		if err != nil {
			return err
		}
		return runMCPStdio(os.Stdin, os.Stdout, store)
	},
}

func runMCPStdio(in io.Reader, out io.Writer, store *config.Store) error {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req map[string]interface{}
		if err := json.Unmarshal(line, &req); err != nil {
			continue
		}
		resp := handleMCPRequest(req, store)
		data, _ := json.Marshal(resp)
		if _, err := fmt.Fprintln(out, string(data)); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func handleMCPRequest(req map[string]interface{}, store *config.Store) map[string]interface{} {
	id := req["id"]
	method, _ := req["method"].(string)
	resp := map[string]interface{}{"jsonrpc": "2.0", "id": id}

	switch method {
	case "initialize":
		resp["result"] = map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"serverInfo":      map[string]string{"name": "devnest", "version": "1.0.0"},
			"capabilities":    map[string]interface{}{"tools": map[string]interface{}{}},
		}
	case "tools/list":
		resp["result"] = map[string]interface{}{
			"tools": []map[string]interface{}{
				{"name": "list_sites", "description": "List all DevNest local sites", "inputSchema": map[string]string{"type": "object"}},
				{"name": "link_site", "description": "Link a folder as a *.test site", "inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"path":   map[string]string{"type": "string"},
						"domain": map[string]string{"type": "string"},
					},
				}},
				{"name": "start_service", "description": "Start a DevNest service (daemon must be running)", "inputSchema": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"service_id": map[string]string{"type": "string"},
					},
					"required": []string{"service_id"},
				}},
			},
		}
	case "tools/call":
		params, _ := req["params"].(map[string]interface{})
		name, _ := params["name"].(string)
		args, _ := params["arguments"].(map[string]interface{})
		resp["result"] = mcpStdioToolCall(name, args, store)
	case "notifications/initialized", "ping":
		resp["result"] = map[string]interface{}{}
	default:
		resp["error"] = map[string]interface{}{"code": -32601, "message": "method not found: " + method}
	}
	return resp
}

func mcpStdioToolCall(name string, args map[string]interface{}, store *config.Store) map[string]interface{} {
	textResult := func(text string, isErr bool) map[string]interface{} {
		r := map[string]interface{}{"content": []map[string]string{{"type": "text", "text": text}}}
		if isErr {
			r["isError"] = true
		}
		return r
	}

	switch name {
	case "list_sites":
		items := store.GetSites()
		data, _ := json.MarshalIndent(items, "", "  ")
		return textResult(string(data), false)
	case "link_site":
		path, _ := args["path"].(string)
		domain, _ := args["domain"].(string)
		entry, err := sites.LinkProject(store, path, domain, true)
		if err != nil {
			return textResult(err.Error(), true)
		}
		data, _ := json.MarshalIndent(entry, "", "  ")
		return textResult(string(data), false)
	case "start_service":
		id, _ := args["service_id"].(string)
		out, err := apiPost("/api/services/" + id + "/start")
		if err != nil {
			return textResult(err.Error(), true)
		}
		data, _ := json.MarshalIndent(out, "", "  ")
		return textResult(string(data), false)
	default:
		return textResult("unknown tool: "+name, true)
	}
}

func initMCPCLI() {
	rootCmd.AddCommand(mcpStdioCmd)
}
