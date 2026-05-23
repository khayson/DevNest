package cmd

import (
	"context"
	"devnest/pkg/service"
	"devnest/pkg/service/dns"
	"devnest/pkg/service/dump"
	"devnest/pkg/service/mail"
	"devnest/pkg/telemetry"
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
		poller.Start(func(metrics map[string]*telemetry.ProcessMetrics) {
			broadcastEvent("telemetry_update", map[string]interface{}{
				"metrics": metrics,
			})
		})

		// Step 3: Initialize Service Manager & Register Services
		manager := service.NewManager()

		// Register DNS Resolver (Tier 1)
		dnsServer := dns.NewServer(53, ".test")
		manager.Register(dnsServer)

		// Register Email Interceptor
		mailStore := mail.NewStore(100)
		mailServer := mail.NewServer(1025, mailStore, func(email mail.CapturedEmail) {
			broadcastEvent("mail_captured", map[string]interface{}{"email": email})
		})
		manager.Register(mailServer)

		// Register Dump Server
		dumpStore := dump.NewStore(200)
		dumpServer := dump.NewServer(9912, dumpStore, func(entry dump.CapturedDump) {
			broadcastEvent("dump_captured", map[string]interface{}{"dump": entry})
		})
		manager.Register(dumpServer)

		// Start all registered services
		if err := manager.StartAll(); err != nil {
			log.Fatalf("[Daemon] Failed to start services: %v", err)
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
		manager.StopAll()

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

	// Keep connection alive, listen for UI commands
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			hub.Unregister(conn)
			break
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
