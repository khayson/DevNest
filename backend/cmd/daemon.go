package cmd

import (
	"context"
	"devnest/internal/config"
	osutil "devnest/internal/os"
	"devnest/internal/service"
	"devnest/internal/service/dns"
	"devnest/internal/service/dump"
	"devnest/internal/service/mail"
	"devnest/internal/telemetry"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
)

// --- Thread-Safe WebSocket Hub ---

// Hub manages all active WebSocket connections with proper synchronization.
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (h *Hub) Register(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	log.Printf("[Daemon] New WebSocket client connected (total: %d)", len(h.clients))
}

func (h *Hub) Unregister(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[conn]; ok {
		conn.Close()
		delete(h.clients, conn)
		log.Printf("[Daemon] WebSocket client disconnected (total: %d)", len(h.clients))
	}
}

// Broadcast sends a JSON payload to all connected clients.
// Drops slow/dead clients automatically.
func (h *Hub) Broadcast(payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if err := client.WriteMessage(websocket.TextMessage, payload); err != nil {
			// Schedule removal outside the read lock
			go h.Unregister(client)
		}
	}
}

// --- Origin Whitelist ---

var allowedOrigins = []string{
	"http://localhost",
	"http://127.0.0.1",
	"https://localhost",
	"https://127.0.0.1",
	"tauri://localhost",
	"http://tauri.localhost",
	"https://tauri.localhost",
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		// Allow connections with no origin (CLI tools, Tauri sidecar)
		// or "null" origin (file:// pages used for local testing)
		if origin == "" || origin == "null" {
			return true
		}
		for _, allowed := range allowedOrigins {
			if strings.HasPrefix(origin, allowed) {
				return true
			}
		}
		log.Printf("[Daemon] Rejected WebSocket from unauthorized origin: %s", origin)
		return false
	},
}

// --- Global Hub & Stores ---

var hub = NewHub()
var globalManager *service.Manager
var cfgStore *config.Store

var serviceStatesMu sync.RWMutex
var serviceStates = map[string]bool{
	"caddy":                true,
	"php":                  true,
	"mysql":                true,
	"postgres":             true,
	"redis":                true,
	"embedded-mail-server": true,
	"embedded-dump-server": true,
	"dns":                  true,
	"cron":                 true,
	"queue":                true,
}

func setAllServiceStates(running bool) {
	serviceStatesMu.Lock()
	defer serviceStatesMu.Unlock()
	for k := range serviceStates {
		serviceStates[k] = running
	}
}

func setServiceState(id string, running bool) {
	serviceStatesMu.Lock()
	defer serviceStatesMu.Unlock()
	mappedID := id
	if id == "dns-resolver" {
		mappedID = "dns"
	} else if id == "embedded-smtp" {
		mappedID = "embedded-mail-server"
	}
	serviceStates[mappedID] = running
}

func getCombinedMetrics() map[string]*telemetry.ProcessMetrics {
	metrics := make(map[string]*telemetry.ProcessMetrics)
	serviceStatesMu.RLock()
	defer serviceStatesMu.RUnlock()

	// Default simulated metrics values
	simData := map[string]struct {
		PID         int32
		CPUPercent  float64
		MemoryBytes uint64
	}{
		"caddy":                {1234, 0.8, 25000000},
		"php":                  {5678, 0.4, 32000000},
		"mysql":                {9012, 1.2, 128000000},
		"postgres":             {3456, 0.5, 64000000},
		"redis":                {7890, 0.1, 16000000},
		"embedded-mail-server": {2345, 0.2, 12000000},
		"embedded-dump-server": {6789, 0.2, 10000000},
		"dns":                  {1011, 0.1, 8000000},
		"cron":                 {1213, 0.1, 15000000},
		"queue":                {1415, 0.3, 28000000},
	}

	for id, running := range serviceStates {
		if running {
			if data, ok := simData[id]; ok {
				metrics[id] = &telemetry.ProcessMetrics{
					PID:         data.PID,
					CPUPercent:  data.CPUPercent,
					MemoryBytes: data.MemoryBytes,
				}
			}
		}
	}
	return metrics
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

		// Initialize config store
		var err error
		cfgStore, err = config.NewStore()
		if err != nil {
			log.Fatalf("[Daemon] Failed to initialize config store: %v", err)
		}

		// Set initial states based on configured auto-start preference
		setAllServiceStates(cfgStore.GetConfig().AutoStartServices)

		// Step 1: Start WebSocket Server
		mux := http.NewServeMux()
		mux.HandleFunc("/ws", handleWebSocket)

		server := &http.Server{
			Addr:    "127.0.0.1:9090",
			Handler: mux,
		}

		go func() {
			log.Println("[Daemon] WebSocket server listening on 127.0.0.1:9090")
			if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatalf("[Daemon] Failed to start WebSocket server: %v", err)
			}
		}()

		// Step 2: Initialize and Start Telemetry Poller
		poller := telemetry.NewPoller(2 * time.Second)
		poller.Start(func(id string) bool {
			serviceStatesMu.RLock()
			defer serviceStatesMu.RUnlock()
			return serviceStates[id]
		}, func(metrics map[string]*telemetry.ProcessMetrics) {
			broadcastEvent("telemetry_update", map[string]interface{}{
				"metrics": metrics,
			})
		})

		// Step 3: Initialize Service Manager & Register Services
		globalManager = service.NewManager()

		// Register DNS Resolver (Tier 1)
		dnsServer := dns.NewServer(53, ".test")
		globalManager.Register(dnsServer)

		// Register Email Interceptor
		mailStore := mail.NewStore(100)
		mailServer := mail.NewServer(1025, mailStore, func(email mail.CapturedEmail) {
			broadcastEvent("mail_captured", map[string]interface{}{"email": email})
		})
		globalManager.Register(mailServer)

		// Register Dump Server
		dumpStore := dump.NewStore(200)
		dumpServer := dump.NewServer(9912, dumpStore, func(entry dump.CapturedDump) {
			broadcastEvent("dump_captured", map[string]interface{}{"dump": entry})
		})
		globalManager.Register(dumpServer)

		// Start all registered services if auto-start is enabled
		if cfgStore.GetConfig().AutoStartServices {
			log.Println("[Daemon] AutoStartServices is enabled. Starting all registered services...")
			if err := globalManager.StartAll(); err != nil {
				log.Fatalf("[Daemon] Failed to start services: %v", err)
			}
		} else {
			log.Println("[Daemon] AutoStartServices is disabled. Services will remain idle until manually started.")
		}

		// (Log Aggregator could be added here later once integrated with UI)

		// Step 4: Wait for OS shutdown signal (Graceful Shutdown)
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		sig := <-quit

		log.Printf("[Daemon] Received %s signal. Shutting down gracefully...", sig)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			log.Printf("[Daemon] HTTP server shutdown error: %v", err)
		}

		poller.Stop()
		globalManager.StopAll()

		log.Println("[Daemon] All services stopped. Goodbye.")

	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[Daemon] WebSocket upgrade error:", err)
		return
	}

	hub.Register(conn)

	// Send initial config to the newly connected client
	if cfgStore != nil {
		cfg := cfgStore.GetConfig()
		resp := map[string]interface{}{
			"event":  "config_update",
			"config": cfg,
		}
		if payload, err := json.Marshal(resp); err == nil {
			conn.WriteMessage(websocket.TextMessage, payload)
		}
	}

	// Keep connection alive, listen for UI commands
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			hub.Unregister(conn)
			break
		}

		var wsMsg struct {
			Type    string                 `json:"type"`
			Command string                 `json:"command"`
			Payload map[string]interface{} `json:"payload"`
		}
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			log.Println("[Daemon] Failed to unmarshal WS message:", err)
			continue
		}

		if wsMsg.Type == "command" {
			log.Printf("[Daemon] Received command: %s", wsMsg.Command)
			if globalManager == nil {
				log.Println("[Daemon] Error: globalManager is nil")
				continue
			}
			switch wsMsg.Command {
			case "get_config":
				if cfgStore != nil {
					cfg := cfgStore.GetConfig()
					resp := map[string]interface{}{
						"event":  "config_update",
						"config": cfg,
					}
					if payload, err := json.Marshal(resp); err == nil {
						conn.WriteMessage(websocket.TextMessage, payload)
					}
				}
			case "update_settings":
				launchOnStartup, _ := wsMsg.Payload["launch_on_startup"].(bool)
				autoStartServices, _ := wsMsg.Payload["auto_start_services"].(bool)
				theme, _ := wsMsg.Payload["theme"].(string)

				log.Printf("[Daemon] Updating settings - LaunchOnStartup: %t, AutoStartServices: %t, Theme: %s", launchOnStartup, autoStartServices, theme)

				if err := cfgStore.UpdateSettings(launchOnStartup, autoStartServices, theme); err != nil {
					log.Printf("[Daemon] Error updating settings: %v", err)
				}
				if err := osutil.SetLaunchOnStartup(launchOnStartup); err != nil {
					log.Printf("[Daemon] Error setting launch on startup: %v", err)
				}

				// Broadcast config update to all clients
				broadcastEvent("config_update", map[string]interface{}{"config": cfgStore.GetConfig()})

			case "start_all":
				setAllServiceStates(true)
				if err := globalManager.StartAll(); err != nil {
					log.Printf("[Daemon] Error starting all: %v", err)
				}
				broadcastEvent("telemetry_update", map[string]interface{}{"metrics": getCombinedMetrics()})
			case "stop_all":
				setAllServiceStates(false)
				globalManager.StopAll()
				broadcastEvent("telemetry_update", map[string]interface{}{"metrics": getCombinedMetrics()})
			case "start_service":
				if serviceId, ok := wsMsg.Payload["serviceId"].(string); ok {
					setServiceState(serviceId, true)
					backendId := serviceId
					if serviceId == "dns" {
						backendId = "dns-resolver"
					} else if serviceId == "embedded-mail-server" {
						backendId = "embedded-smtp"
					}
					if srv, found := globalManager.GetService(backendId); found {
						srv.Configure()
						if err := srv.Start(); err != nil {
							log.Printf("[Daemon] Error starting service %s: %v", serviceId, err)
						}
					}
					broadcastEvent("telemetry_update", map[string]interface{}{"metrics": getCombinedMetrics()})
				}
			case "stop_service":
				if serviceId, ok := wsMsg.Payload["serviceId"].(string); ok {
					setServiceState(serviceId, false)
					backendId := serviceId
					if serviceId == "dns" {
						backendId = "dns-resolver"
					} else if serviceId == "embedded-mail-server" {
						backendId = "embedded-smtp"
					}
					if srv, found := globalManager.GetService(backendId); found {
						if err := srv.Stop(); err != nil {
							log.Printf("[Daemon] Error stopping service %s: %v", serviceId, err)
						}
					}
					broadcastEvent("telemetry_update", map[string]interface{}{"metrics": getCombinedMetrics()})
				}
			case "restart_service":
				if serviceId, ok := wsMsg.Payload["serviceId"].(string); ok {
					setServiceState(serviceId, true)
					backendId := serviceId
					if serviceId == "dns" {
						backendId = "dns-resolver"
					} else if serviceId == "embedded-mail-server" {
						backendId = "embedded-smtp"
					}
					if srv, found := globalManager.GetService(backendId); found {
						srv.Stop()
						srv.Configure()
						if err := srv.Start(); err != nil {
							log.Printf("[Daemon] Error restarting service %s: %v", serviceId, err)
						}
					}
					broadcastEvent("telemetry_update", map[string]interface{}{"metrics": getCombinedMetrics()})
				}
			}
		}
	}
}

// broadcastEvent constructs and broadcasts a typed JSON event to all WS clients.
func broadcastEvent(eventType string, data map[string]interface{}) {
	data["event"] = eventType
	payload, err := json.Marshal(data)
	if err != nil {
		return
	}
	hub.Broadcast(payload)
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
