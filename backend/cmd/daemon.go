package cmd

import (
	"context"
	"devnest/internal/config"
	osutil "devnest/internal/os"
	"devnest/internal/service"
	"devnest/internal/service/caddy"
	"devnest/internal/service/dns"
	"devnest/internal/service/dump"
	"devnest/internal/service/logs"
	"devnest/internal/service/mail"
	"devnest/internal/telemetry"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
)

// --- Thread-Safe WebSocket Hub ---

// wsClient wraps a connection with a write mutex (gorilla/websocket is not concurrent-write safe).
type wsClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

// Hub manages all active WebSocket connections with proper synchronization.
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]*wsClient
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]*wsClient),
	}
}

func (h *Hub) Register(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = &wsClient{conn: conn}
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

// Write sends a text message to a single client (serialized per connection).
func (h *Hub) Write(conn *websocket.Conn, payload []byte) error {
	h.mu.RLock()
	client, ok := h.clients[conn]
	h.mu.RUnlock()
	if !ok {
		return nil
	}
	client.mu.Lock()
	defer client.mu.Unlock()
	return client.conn.WriteMessage(websocket.TextMessage, payload)
}

// Broadcast sends a JSON payload to all connected clients.
func (h *Hub) Broadcast(payload []byte) {
	h.mu.RLock()
	snapshot := make([]*wsClient, 0, len(h.clients))
	for _, c := range h.clients {
		snapshot = append(snapshot, c)
	}
	h.mu.RUnlock()

	for _, client := range snapshot {
		client.mu.Lock()
		err := client.conn.WriteMessage(websocket.TextMessage, payload)
		client.mu.Unlock()
		if err != nil {
			go h.Unregister(client.conn)
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
var globalMailStore *mail.Store
var globalDumpStore *dump.Store
var globalCaddy *caddy.Server
var globalLogManager *logs.Manager
var cfgStore *config.Store

// backendToUI maps daemon service IDs to the IDs used by the frontend.
func backendToUI(backendID string) string {
	switch backendID {
	case "dns-resolver":
		return "dns"
	case "embedded-smtp":
		return "embedded-mail-server"
	case "caddy-proxy":
		return "caddy"
	case "php-cgi":
		return "php"
	default:
		return backendID
	}
}

// uiToBackend maps frontend service IDs to daemon service IDs.
func uiToBackend(uiID string) string {
	switch uiID {
	case "dns":
		return "dns-resolver"
	case "embedded-mail-server":
		return "embedded-smtp"
	case "caddy":
		return "caddy-proxy"
	case "php":
		return "php-cgi"
	default:
		return uiID
	}
}

// collectServiceTelemetry gathers live health and metrics from registered services.
func collectServiceTelemetry() map[string]interface{} {
	if globalManager == nil {
		return map[string]interface{}{}
	}

	health := globalManager.HealthCheck()
	metrics := globalManager.GetAllMetrics()
	result := make(map[string]interface{}, len(health))

	for backendID, state := range health {
		uiID := backendToUI(backendID)
		entry := map[string]interface{}{
			"state": string(state),
		}
		if m, ok := metrics[backendID]; ok && m != nil {
			entry["pid"] = m.PID
			entry["cpu_percent"] = m.CPUPercent
			entry["memory_bytes"] = m.MemoryBytes
			entry["uptime_seconds"] = m.UptimeSeconds
			entry["open_sockets"] = m.OpenSockets
		}
		result[uiID] = entry
	}
	return result
}

func broadcastTelemetry() {
	broadcastEvent("telemetry_update", map[string]interface{}{
		"metrics": collectServiceTelemetry(),
	})
}

// daemonCmd represents the daemon command
var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Start the DevNest background daemon",
	Long: `Starts the DevNest orchestrator in the background.
This launches the WebSocket server on port 9090 for the Tauri UI,
initializes the telemetry poller, and boots configured services.`,
	Run: func(cmd *cobra.Command, args []string) {
		setupDaemonLogFile()

		log.Println("[Daemon] Booting DevNest Orchestrator...")
		daemonStartedAt = time.Now()

		// Initialize config store
		var err error
		cfgStore, err = config.NewStore()
		if err != nil {
			log.Fatalf("[Daemon] Failed to initialize config store: %v", err)
		}

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
		poller.Start(collectServiceTelemetry, func(metrics map[string]interface{}) {
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
		globalMailStore = mail.NewStore(100)
		mailServer := mail.NewServer(1025, globalMailStore, func(email mail.CapturedEmail) {
			broadcastEvent("mail_captured", map[string]interface{}{"email": email})
		})
		globalManager.Register(mailServer)

		// Register Dump Server
		globalDumpStore = dump.NewStore(200)
		dumpServer := dump.NewServer(9912, globalDumpStore, func(entry dump.CapturedDump) {
			broadcastEvent("dump_captured", map[string]interface{}{"dump": entry})
		})
		globalManager.Register(dumpServer)

		// Register Caddy reverse proxy (optional — skipped if binary not found)
		caddyBin, caddyErr := config.ResolveCaddyBinary()
		caddyDir, _ := config.CaddyConfigDir()
		if caddyErr != nil {
			log.Printf("[Daemon] Caddy not registered: binary not found (%v). Install caddy or add to PATH.", caddyErr)
			globalCaddy = caddy.NewServer("", caddyDir, func() []config.SiteEntry {
				if cfgStore == nil {
					return nil
				}
				return cfgStore.GetSites()
			}, phpPortForSite)
		} else {
			log.Printf("[Daemon] Caddy binary: %s", caddyBin)
			globalCaddy = caddy.NewServer(caddyBin, caddyDir, func() []config.SiteEntry {
				if cfgStore == nil {
					return nil
				}
				return cfgStore.GetSites()
			}, phpPortForSite)
			globalManager.Register(globalCaddy)
		}

		registerPHPService()

		registerDatabaseServices()

		// Register Log Aggregator
		var logMgrErr error
		globalLogManager, logMgrErr = logs.NewManager(2000, func(entry logs.LogEntry) {
			broadcastEvent("log_entry", map[string]interface{}{"entry": entry})
		})
		if logMgrErr != nil {
			log.Printf("[Daemon] Log aggregator unavailable: %v", logMgrErr)
		} else {
			sites := []config.SiteEntry{}
			if cfgStore != nil {
				sites = cfgStore.GetSites()
			}
			if err := globalLogManager.ConfigureSources(sites); err != nil {
				log.Printf("[Daemon] Log source setup warning: %v", err)
			}
			globalLogManager.Start()
			log.Println("[Daemon] Log aggregator watching devnest, caddy, and laravel logs")
		}

		// Start all registered services if auto-start is enabled
		if cfgStore.GetConfig().AutoStartServices {
			log.Println("[Daemon] AutoStartServices is enabled. Starting all registered services...")
			if err := globalManager.StartAll(); err != nil {
				log.Printf("[Daemon] Some services failed to start: %v", err)
			}
		} else {
			log.Println("[Daemon] AutoStartServices is disabled. Services will remain idle until manually started.")
		}

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
		if globalLogManager != nil {
			_ = globalLogManager.Stop()
		}
		globalManager.StopAll()

		log.Println("[Daemon] All services stopped. Goodbye.")

	},
}

func sendLogInbox(conn *websocket.Conn) {
	if globalLogManager == nil {
		return
	}
	entries := globalLogManager.GetAll()
	for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
		entries[i], entries[j] = entries[j], entries[i]
	}
	payload, err := json.Marshal(map[string]interface{}{
		"event":   "log_inbox_sync",
		"entries": entries,
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func refreshLogSources() {
	if globalLogManager == nil || cfgStore == nil {
		return
	}
	if err := globalLogManager.ConfigureSources(cfgStore.GetSites()); err != nil {
		log.Printf("[Daemon] Log source refresh warning: %v", err)
	}
}

func setupDaemonLogFile() {
	logsDir, err := config.LogsDir()
	if err != nil {
		return
	}
	logPath := filepath.Join(logsDir, "devnest.log")
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	log.SetOutput(io.MultiWriter(os.Stderr, f))
}

func sendMailInbox(conn *websocket.Conn) {
	if globalMailStore == nil {
		return
	}
	emails := globalMailStore.GetAll()
	// Newest first for the UI
	for i, j := 0, len(emails)-1; i < j; i, j = i+1, j-1 {
		emails[i], emails[j] = emails[j], emails[i]
	}
	payload, err := json.Marshal(map[string]interface{}{
		"event":  "mail_inbox_sync",
		"emails": emails,
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func sendDumpInbox(conn *websocket.Conn) {
	if globalDumpStore == nil {
		return
	}
	dumps := globalDumpStore.GetAll()
	for i, j := 0, len(dumps)-1; i < j; i, j = i+1, j-1 {
		dumps[i], dumps[j] = dumps[j], dumps[i]
	}
	payload, err := json.Marshal(map[string]interface{}{
		"event": "dump_inbox_sync",
		"dumps": dumps,
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func reloadCaddyIfRunning() {
	if globalCaddy == nil || !globalCaddy.BinaryAvailable() {
		return
	}
	if err := globalCaddy.ReloadConfig(); err != nil {
		log.Printf("[Daemon] Caddy reload failed: %v", err)
	}
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
			_ = hub.Write(conn, payload)
		}
	}

	// Send current service state to the newly connected client
	if telemetryPayload, err := json.Marshal(map[string]interface{}{
		"event":   "telemetry_update",
		"metrics": collectServiceTelemetry(),
	}); err == nil {
		_ = hub.Write(conn, telemetryPayload)
	}

	// Sync captured mail inbox to the client
	sendMailInbox(conn)

	// Sync captured dumps to the client
	sendDumpInbox(conn)

	// Sync registered sites
	sendSitesSync(conn)

	// Sync log entries
	sendLogInbox(conn)

	// Sync PHP installations and config
	sendPHPSync(conn)

	// Sync database services and SQLite scan
	sendDatabaseSync(conn)

	// Sync about / system info
	sendAboutSync(conn)

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
						_ = hub.Write(conn, payload)
					}
				}
			case "get_mail_inbox":
				sendMailInbox(conn)
			case "get_dump_inbox":
				sendDumpInbox(conn)
			case "get_log_inbox":
				sendLogInbox(conn)
			case "get_sites":
				sendSitesSync(conn)
			case "get_php":
				sendPHPSync(conn)
			case "get_databases":
				sendDatabaseSync(conn)
			case "get_about":
				sendAboutSync(conn)
			case "scan_databases":
				handleScanDatabases()
			case "run_migration":
				handleRunMigration(wsMsg.Payload)
			case "set_active_php":
				handleSetActivePHP(wsMsg.Payload)
			case "update_php_ini":
				handleUpdatePHPIni(wsMsg.Payload)
			case "add_site":
				if cfgStore != nil {
					if entry, ok := parseSitePayload(wsMsg.Payload); ok {
						if err := cfgStore.AddSite(entry); err != nil {
							log.Printf("[Daemon] Error adding site: %v", err)
						} else {
							afterSiteMutation()
						}
					}
				}
			case "update_site":
				handleUpdateSite(wsMsg.Payload)
			case "toggle_site_tls":
				handleToggleSiteTLS(wsMsg.Payload)
			case "open_path":
				handleOpenPath(wsMsg.Payload)
			case "remove_site":
				if cfgStore != nil {
					if domain, ok := wsMsg.Payload["domain"].(string); ok {
						if err := cfgStore.RemoveSite(domain); err != nil {
							log.Printf("[Daemon] Error removing site: %v", err)
						} else {
							afterSiteMutation()
						}
					}
				}
			case "clear_mail_inbox":
				if globalMailStore != nil {
					globalMailStore.Clear()
					payload, err := json.Marshal(map[string]interface{}{
						"event":  "mail_inbox_sync",
						"emails": []mail.CapturedEmail{},
					})
					if err == nil {
						hub.Broadcast(payload)
					}
				}
			case "clear_dump_inbox":
				if globalDumpStore != nil {
					globalDumpStore.Clear()
					payload, err := json.Marshal(map[string]interface{}{
						"event": "dump_inbox_sync",
						"dumps": []dump.CapturedDump{},
					})
					if err == nil {
						hub.Broadcast(payload)
					}
				}
			case "clear_log_inbox":
				if globalLogManager != nil {
					globalLogManager.Clear()
					payload, err := json.Marshal(map[string]interface{}{
						"event":   "log_inbox_sync",
						"entries": []logs.LogEntry{},
					})
					if err == nil {
						hub.Broadcast(payload)
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
				if err := globalManager.StartAll(); err != nil {
					log.Printf("[Daemon] Error starting all: %v", err)
				}
				broadcastTelemetry()
				broadcastAboutSync()
			case "stop_all":
				globalManager.StopAll()
				broadcastTelemetry()
				broadcastAboutSync()
			case "start_service":
				if serviceId, ok := wsMsg.Payload["serviceId"].(string); ok {
					backendId := uiToBackend(serviceId)
					if srv, found := globalManager.GetService(backendId); found {
						srv.Configure()
						if err := srv.Start(); err != nil {
							log.Printf("[Daemon] Error starting service %s: %v", serviceId, err)
						}
					}
					broadcastTelemetry()
					broadcastAboutSync()
				}
			case "stop_service":
				if serviceId, ok := wsMsg.Payload["serviceId"].(string); ok {
					backendId := uiToBackend(serviceId)
					if srv, found := globalManager.GetService(backendId); found {
						if err := srv.Stop(); err != nil {
							log.Printf("[Daemon] Error stopping service %s: %v", serviceId, err)
						}
					}
					broadcastTelemetry()
					broadcastAboutSync()
				}
			case "restart_service":
				if serviceId, ok := wsMsg.Payload["serviceId"].(string); ok {
					backendId := uiToBackend(serviceId)
					if srv, found := globalManager.GetService(backendId); found {
						srv.Stop()
						srv.Configure()
						if err := srv.Start(); err != nil {
							log.Printf("[Daemon] Error restarting service %s: %v", serviceId, err)
						}
					}
					broadcastTelemetry()
					broadcastAboutSync()
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

func parseSitePayload(p map[string]interface{}) (config.SiteEntry, bool) {
	domain, _ := p["domain"].(string)
	path, _ := p["path"].(string)
	name, _ := p["name"].(string)
	phpVersion, _ := p["php_version"].(string)
	port := 8000
	if v, ok := p["port"].(float64); ok {
		port = int(v)
	}
	tls := true
	if v, ok := p["tls"].(bool); ok {
		tls = v
	}
	if domain == "" || path == "" {
		return config.SiteEntry{}, false
	}
	return config.SiteEntry{
		Name:       name,
		Domain:     domain,
		Path:       path,
		Port:       port,
		TLS:        tls,
		PHPVersion: phpVersion,
	}, true
}

func init() {
	rootCmd.AddCommand(daemonCmd)
}
