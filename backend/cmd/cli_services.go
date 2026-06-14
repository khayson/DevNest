package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/spf13/cobra"
)

const defaultAPIBase = "http://127.0.0.1:9090"

func apiBaseURL() string {
	if v := os.Getenv("DEVNEST_API"); v != "" {
		return v
	}
	return defaultAPIBase
}

func apiPost(path string) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(apiBaseURL()+path, "application/json", bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, fmt.Errorf("daemon not reachable at %s — start with `devnest daemon`", apiBaseURL())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var out map[string]interface{}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("invalid response: %s", string(body))
	}
	if resp.StatusCode >= 300 {
		if msg, _ := out["error"].(string); msg != "" {
			return out, fmt.Errorf(msg)
		}
		return out, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return out, nil
}

func apiGet(path string) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiBaseURL() + path)
	if err != nil {
		return nil, fmt.Errorf("daemon not reachable at %s", apiBaseURL())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var out map[string]interface{}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

var servicesStartCmd = &cobra.Command{
	Use:   "start <service-id>",
	Short: "Start a service via the daemon HTTP API",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		out, err := apiPost("/api/services/" + args[0] + "/start")
		if err != nil {
			return err
		}
		printJSON(out)
		return nil
	},
}

var servicesStopCmd = &cobra.Command{
	Use:   "stop <service-id>",
	Short: "Stop a service via the daemon HTTP API",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		out, err := apiPost("/api/services/" + args[0] + "/stop")
		if err != nil {
			return err
		}
		printJSON(out)
		return nil
	},
}

var servicesRestartCmd = &cobra.Command{
	Use:   "restart <service-id>",
	Short: "Restart a service via the daemon HTTP API",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		out, err := apiPost("/api/services/" + args[0] + "/restart")
		if err != nil {
			return err
		}
		printJSON(out)
		return nil
	},
}

var servicesStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show service states from the daemon",
	RunE: func(cmd *cobra.Command, args []string) error {
		out, err := apiGet("/api/services")
		if err != nil {
			return err
		}
		asJSON, _ := cmd.Flags().GetBool("json")
		if asJSON {
			printJSON(out)
			return nil
		}
		items, _ := out["services"].([]interface{})
		for _, item := range items {
			m, _ := item.(map[string]interface{})
			fmt.Printf("%-24s %-10s %s\n", m["id"], m["state"], m["name"])
		}
		return nil
	},
}

func printJSON(v interface{}) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func initServicesCLI() {
	servicesStatusCmd.Flags().Bool("json", false, "Output JSON")
	servicesCmd.AddCommand(servicesStartCmd)
	servicesCmd.AddCommand(servicesStopCmd)
	servicesCmd.AddCommand(servicesRestartCmd)
	servicesCmd.AddCommand(servicesStatusCmd)
}
