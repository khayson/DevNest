package cmd

import (
	"devnest/pkg/telemetry"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local UI
	},
}

// daemonCmd represents the daemon command
var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Start the DevNest background daemon",
	Long: `Starts the DevNest orchestrator in the background.
This launches the WebSocket server on port 9090 for the Tauri UI,
initializes the telemetry poller, and boots configured services.`,
	Run: func(cmd *cobra.Command, args []string) {
		log.Println("[Daemon] Booting DevNest Orchestrator...")

		// Step 1: Start WebSocket Server
		http.HandleFunc("/ws", handleWebSocket)
		
		go func() {
			log.Println("[Daemon] WebSocket server listening on 127.0.0.1:9090")
			if err := http.ListenAndServe("127.0.0.1:9090", nil); err != nil {
				log.Fatalf("[Daemon] Failed to start WebSocket server: %v", err)
			}
		}()

		// Step 2: Initialize and Start Telemetry Poller
		poller := telemetry.NewPoller(2 * time.Second)
		poller.Start(func(metrics map[string]*telemetry.ProcessMetrics) {
			// In a real implementation, we broadcast this map to all connected WS clients.
			broadcastMetrics(metrics)
		})

		// Block forever (or wait for OS signals)
		select {}
	},
}

// Connected WebSocket clients
var clients = make(map[*websocket.Conn]bool)

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	log.Println("[Daemon] New WebSocket client connected")
	clients[conn] = true

	for {
		// Keep connection alive, listen for UI commands
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Println("[Daemon] WebSocket client disconnected")
			delete(clients, conn)
			break
		}
	}
}

func broadcastMetrics(metrics map[string]*telemetry.ProcessMetrics) {
	if len(clients) == 0 {
		return
	}

	payload, err := json.Marshal(map[string]interface{}{
		"event":   "telemetry_update",
		"metrics": metrics,
	})
	if err != nil {
		return
	}

	for client := range clients {
		if err := client.WriteMessage(websocket.TextMessage, payload); err != nil {
			client.Close()
			delete(clients, client)
		}
	}
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
