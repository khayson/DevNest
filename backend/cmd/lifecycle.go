package cmd

import (
	"devnest/internal/launcher"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/spf13/cobra"
)

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the DevNest daemon in the background",
	RunE: func(cmd *cobra.Command, args []string) error {
		_ = launcher.EnsureRunning()
		result, err := launcher.StartDaemon()
		if err != nil {
			return err
		}
		if result.AlreadyRunning {
			fmt.Println("DevNest daemon already running on http://127.0.0.1:9090")
			return nil
		}
		fmt.Println("Daemon ready at ws://127.0.0.1:9090/ws")
		return nil
	},
}

var stopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the DevNest daemon gracefully",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := launcher.GracefulShutdown(); err != nil {
			return err
		}
		fmt.Println("DevNest daemon stopped.")
		return nil
	},
}

var stopAllCmd = &cobra.Command{
	Use:   "stop-all",
	Short: "Stop the daemon and all DevNest-related processes (like stop-daemon.ps1)",
	RunE: func(cmd *cobra.Command, args []string) error {
		stopped, err := launcher.StopEnvironment()
		if err != nil {
			return err
		}
		fmt.Printf("Stopped %d process(es).\n", len(stopped))
		return nil
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show daemon and service status",
	RunE: func(cmd *cobra.Command, args []string) error {
		asJSON, _ := cmd.Flags().GetBool("json")
		running := launcher.DaemonReachable()
		if !running {
			if asJSON {
				fmt.Println(`{"running":false,"launcher":` + boolJSON(launcher.LauncherReachable()) + `}`)
			} else {
				fmt.Println("DevNest daemon: stopped")
				if launcher.LauncherReachable() {
					fmt.Println("Launcher control API: running on http://127.0.0.1:9089")
				}
			}
			return nil
		}
		return printDaemonStatus(asJSON)
	},
}

func boolJSON(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

func printDaemonStatus(asJSON bool) error {
	client := &http.Client{Timeout: 3 * time.Second}
	infoResp, err := client.Get("http://127.0.0.1:9090/api/info")
	if err != nil {
		return err
	}
	defer infoResp.Body.Close()
	var info map[string]interface{}
	_ = json.NewDecoder(infoResp.Body).Decode(&info)

	svcResp, err := client.Get("http://127.0.0.1:9090/api/services")
	if err != nil {
		return err
	}
	defer svcResp.Body.Close()
	var svcWrap map[string]interface{}
	_ = json.NewDecoder(svcResp.Body).Decode(&svcWrap)

	if asJSON {
		out := map[string]interface{}{
			"running":  true,
			"launcher": launcher.LauncherReachable(),
			"info":     info,
			"services": svcWrap["services"],
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(out)
	}

	fmt.Println("DevNest daemon: running on http://127.0.0.1:9090")
	if services, ok := svcWrap["services"].([]interface{}); ok {
		running := 0
		for _, item := range services {
			m, _ := item.(map[string]interface{})
			if m["state"] == "running" {
				running++
			}
		}
		fmt.Printf("Services: %d/%d running\n", running, len(services))
		for _, item := range services {
			m, _ := item.(map[string]interface{})
			fmt.Printf("  %-22s %s\n", m["id"], m["state"])
		}
	}
	return nil
}

func initLifecycle() {
	statusCmd.Flags().Bool("json", false, "Output JSON")
	rootCmd.AddCommand(startCmd)
	rootCmd.AddCommand(stopCmd)
	rootCmd.AddCommand(stopAllCmd)
	rootCmd.AddCommand(statusCmd)
}
