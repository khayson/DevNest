package cmd

import (
	"devnest/internal/service/php"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gorilla/websocket"
)

func phpDiscoverCLI() []php.Installation {
	return php.DiscoverInstallations()
}

func phpInstallCLI(version string) (php.InstallResult, error) {
	return php.InstallWindows(version, nil)
}

func cliDaemonCommand(command string, payload map[string]interface{}) error {
	conn, _, err := websocket.DefaultDialer.Dial("ws://127.0.0.1:9090/ws", nil)
	if err != nil {
		return fmt.Errorf("daemon not running on :9090 — start it with `devnest daemon`")
	}
	defer conn.Close()

	msg := map[string]interface{}{
		"type":    "command",
		"command": command,
		"payload": payload,
	}
	if err := conn.WriteJSON(msg); err != nil {
		return err
	}
	_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	for {
		var resp map[string]interface{}
		if err := conn.ReadJSON(&resp); err != nil {
			return err
		}
		if event, _ := resp["event"].(string); event == "debug_result" || event == "php_install_result" {
			if success, _ := resp["success"].(bool); !success {
				if msg, _ := resp["message"].(string); msg != "" {
					return fmt.Errorf(msg)
				}
				return fmt.Errorf("command failed")
			}
			out, _ := json.MarshalIndent(resp, "", "  ")
			fmt.Println(string(out))
			return nil
		}
	}
}
