package launcher

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

const DefaultAddr = "127.0.0.1:9089"

// Server exposes HTTP endpoints to start/stop the DevNest daemon without a terminal.
type Server struct {
	addr string
	mu   sync.Mutex
}

func NewServer(addr string) *Server {
	if addr == "" {
		addr = DefaultAddr
	}
	return &Server{addr: addr}
}

// ListenAndServe blocks until the HTTP server exits.
func (s *Server) ListenAndServe() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/daemon/start", s.handleStart)
	mux.HandleFunc("/api/daemon/stop", s.handleStop)
	mux.HandleFunc("/api/daemon/restart", s.handleRestart)
	mux.HandleFunc("/api/daemon/shutdown", s.handleShutdown)

	log.Printf("[Launcher] Control API listening on http://%s", s.addr)
	return http.ListenAndServe(s.addr, withCORS(mux))
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, map[string]interface{}{
		"ok":             true,
		"daemon_running": DaemonReachable(),
		"launcher":       true,
	})
}

func (s *Server) handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	result, err := StartDaemon()
	resp := map[string]interface{}{"success": err == nil, "result": result}
	if err != nil {
		resp["message"] = err.Error()
	}
	writeJSON(w, resp)
}

func (s *Server) handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	stopped, err := StopEnvironment()
	resp := map[string]interface{}{"success": err == nil, "stopped_pids": stopped}
	if err != nil {
		resp["message"] = err.Error()
	}
	writeJSON(w, resp)
}

func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := StopEnvironment(); err != nil {
		writeJSON(w, map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	time.Sleep(500 * time.Millisecond)
	result, err := StartDaemon()
	resp := map[string]interface{}{"success": err == nil, "result": result}
	if err != nil {
		resp["message"] = err.Error()
	}
	writeJSON(w, resp)
}

func (s *Server) handleShutdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	err := GracefulShutdown()
	resp := map[string]interface{}{"success": err == nil}
	if err != nil {
		resp["message"] = err.Error()
	}
	writeJSON(w, resp)
}

// StopEnvironment stops DevNest daemon and related child processes (mirrors stop-daemon.ps1).
func StopEnvironment() ([]int, error) {
	return stopEnvironmentPlatform()
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// LauncherReachable reports whether the control API is responding.
func LauncherReachable() bool {
	client := &http.Client{Timeout: 400 * time.Millisecond}
	resp, err := client.Get("http://" + DefaultAddr + "/api/health")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// EnsureRunning starts the launcher in the background if it is not already up.
func EnsureRunning() error {
	if LauncherReachable() {
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return startDetached(exe, "launcher")
}

// StartResult describes a daemon start attempt.
type StartResult struct {
	AlreadyRunning bool   `json:"already_running,omitempty"`
	PID            int    `json:"pid,omitempty"`
	Message        string `json:"message,omitempty"`
}

// DaemonReachable reports whether the main daemon HTTP API is up.
func DaemonReachable() bool {
	client := &http.Client{Timeout: 800 * time.Millisecond}
	resp, err := client.Get("http://127.0.0.1:9090/api/info")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// StartDaemon spawns devnest daemon detached and waits until :9090 responds.
func StartDaemon() (StartResult, error) {
	if DaemonReachable() {
		return StartResult{AlreadyRunning: true, Message: "daemon already running"}, nil
	}
	exe, err := os.Executable()
	if err != nil {
		return StartResult{}, err
	}
	if err := startDetached(exe, "daemon"); err != nil {
		return StartResult{}, err
	}
	for i := 0; i < 24; i++ {
		time.Sleep(250 * time.Millisecond)
		if DaemonReachable() {
			return StartResult{Message: "daemon ready on :9090"}, nil
		}
	}
	return StartResult{}, fmt.Errorf("daemon started but not responding on :9090 — check ~/.devnest/logs/devnest.log")
}

// GracefulShutdown asks a running daemon to exit via /api/shutdown.
func GracefulShutdown() error {
	if !DaemonReachable() {
		return nil
	}
	req, err := http.NewRequest(http.MethodPost, "http://127.0.0.1:9090/api/shutdown", nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	for i := 0; i < 20; i++ {
		time.Sleep(250 * time.Millisecond)
		if !DaemonReachable() {
			return nil
		}
	}
	return fmt.Errorf("daemon still responding after shutdown request")
}

func startDetached(exe, subcommand string) error {
	c := exec.Command(exe, subcommand)
	c.Dir = filepath.Dir(exe)
	return attachDetached(c)
}
