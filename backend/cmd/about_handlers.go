package cmd

import (
	"devnest/internal/config"
	"devnest/internal/service"
	"devnest/internal/service/database"
	"devnest/internal/service/php"
	"encoding/json"
	"path/filepath"
	"runtime"
	"time"

	"github.com/gorilla/websocket"
)

const DaemonVersion = "0.1.0"

var daemonStartedAt time.Time

type aboutPathEntry struct {
	Label string `json:"label"`
	Path  string `json:"path"`
	Note  string `json:"note"`
}

type aboutEndpointEntry struct {
	Label   string `json:"label"`
	Address string `json:"address"`
	Note    string `json:"note"`
}

type aboutServiceEntry struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	State     string `json:"state"`
	Port      string `json:"port,omitempty"`
	Available bool   `json:"available"`
}

type aboutCapabilities struct {
	Caddy      bool `json:"caddy"`
	PHP        bool `json:"php"`
	MySQL      bool `json:"mysql"`
	PostgreSQL bool `json:"postgres"`
	Redis      bool `json:"redis"`
}

type aboutPayload struct {
	DaemonVersion      string               `json:"daemon_version"`
	GoVersion          string               `json:"go_version"`
	OS                 string               `json:"os"`
	Arch               string               `json:"arch"`
	StartedAt          string               `json:"started_at"`
	UptimeSeconds      float64              `json:"uptime_seconds"`
	ConfigPath         string               `json:"config_path"`
	DevnestDir         string               `json:"devnest_dir"`
	LogsDir            string               `json:"logs_dir"`
	CaddyDir           string               `json:"caddy_dir"`
	SiteCount          int                  `json:"site_count"`
	RunningServices    int                  `json:"running_services"`
	RegisteredServices int                  `json:"registered_services"`
	AutoStartServices  bool                 `json:"auto_start_services"`
	LaunchOnStartup    bool                 `json:"launch_on_startup"`
	ActivePHPVersion   string               `json:"active_php_version,omitempty"`
	PHPInstallations   int                  `json:"php_installations"`
	Capabilities       aboutCapabilities    `json:"capabilities"`
	Paths              []aboutPathEntry     `json:"paths"`
	Endpoints          []aboutEndpointEntry `json:"endpoints"`
	Services           []aboutServiceEntry  `json:"services"`
}

func buildAboutPayload() aboutPayload {
	devnestDir, _ := config.DevnestDir()
	logsDir, _ := config.LogsDir()
	caddyDir, _ := config.CaddyConfigDir()

	configPath := ""
	siteCount := 0
	autoStart := false
	launchOnStartup := false
	activePHP := ""
	if cfgStore != nil {
		home, _ := config.DevnestDir()
		if home != "" {
			configPath = filepath.Join(home, "devnest.json")
		}
		siteCount = len(cfgStore.GetSites())
		cfg := cfgStore.GetConfig()
		autoStart = cfg.AutoStartServices
		launchOnStartup = cfg.LaunchOnStartup
		activePHP = cfg.ActivePHPVersion
	}

	_, caddyOK := config.ResolveCaddyBinary()
	phpInstalls := php.DiscoverInstallations()
	_, mysqlOK := database.ResolveMySQL()
	_, pgOK := database.ResolvePostgreSQL()
	_, redisOK := database.ResolveRedis()

	caps := aboutCapabilities{
		Caddy:      caddyOK == nil,
		PHP:        len(phpInstalls) > 0,
		MySQL:      mysqlOK == nil,
		PostgreSQL: pgOK == nil,
		Redis:      redisOK == nil,
	}

	running := 0
	registered := 0
	var services []aboutServiceEntry

	if globalManager != nil {
		health := globalManager.HealthCheck()
		registered = len(health)
		for id, state := range health {
			if state == service.StateRunning {
				running++
			}
			services = append(services, aboutServiceEntry{
				ID:        backendToUI(id),
				Name:      serviceDisplayName(id),
				State:     string(state),
				Port:      servicePortLabel(id),
				Available: true,
			})
		}
	}

	// Optional services that were not registered (binary missing)
	for _, opt := range []struct {
		id, name, port string
		ok             bool
	}{
		{"caddy-proxy", "Caddy Reverse Proxy", "80, 443", caps.Caddy},
		{"php-cgi", "PHP CGI", "9074", caps.PHP},
		{"mysql", "MySQL Server", "3306", caps.MySQL},
		{"postgres", "PostgreSQL", "5432", caps.PostgreSQL},
		{"redis", "Redis", "6379", caps.Redis},
	} {
		uiID := backendToUI(opt.id)
		found := false
		for _, s := range services {
			if s.ID == uiID {
				found = true
				break
			}
		}
		if !found {
			services = append(services, aboutServiceEntry{
				ID:        uiID,
				Name:      opt.name,
				State:     "unavailable",
				Port:      opt.port,
				Available: false,
			})
		}
	}

	uptime := 0.0
	startedAt := ""
	if !daemonStartedAt.IsZero() {
		uptime = time.Since(daemonStartedAt).Seconds()
		startedAt = daemonStartedAt.UTC().Format(time.RFC3339)
	}

	return aboutPayload{
		DaemonVersion:      DaemonVersion,
		GoVersion:          runtime.Version(),
		OS:                 runtime.GOOS,
		Arch:               runtime.GOARCH,
		StartedAt:          startedAt,
		UptimeSeconds:      uptime,
		ConfigPath:         configPath,
		DevnestDir:         devnestDir,
		LogsDir:            logsDir,
		CaddyDir:           caddyDir,
		SiteCount:          siteCount,
		RunningServices:    running,
		RegisteredServices: registered,
		AutoStartServices:  autoStart,
		LaunchOnStartup:    launchOnStartup,
		ActivePHPVersion:   activePHP,
		PHPInstallations:   len(phpInstalls),
		Capabilities:       caps,
		Paths: []aboutPathEntry{
			{Label: "DevNest home", Path: devnestDir, Note: "Config, logs, runtimes, and data"},
			{Label: "Config file", Path: configPath, Note: "Sites, theme, and preferences"},
			{Label: "Logs directory", Path: logsDir, Note: "devnest.log and service logs"},
			{Label: "Caddy config", Path: caddyDir, Note: "Generated Caddyfile"},
		},
		Endpoints: []aboutEndpointEntry{
			{Label: "Daemon WebSocket", Address: "ws://127.0.0.1:9090/ws", Note: "UI ↔ Go orchestrator"},
			{Label: "Mail interceptor", Address: "127.0.0.1:1025", Note: "SMTP capture for local apps"},
			{Label: "Dump server", Address: "127.0.0.1:9912", Note: "dd() / dump() collector"},
			{Label: "DNS resolver", Address: "127.0.0.1:53", Note: "Resolves *.test to localhost"},
			{Label: "PHP FastCGI", Address: "127.0.0.1:9074", Note: "Laravel sites via Caddy"},
		},
		Services: services,
	}
}

func serviceDisplayName(id string) string {
	switch id {
	case "dns-resolver":
		return "Local DNS Resolver"
	case "embedded-smtp":
		return "Mail Interceptor"
	case "embedded-dump-server":
		return "Dump Server"
	case "caddy-proxy":
		return "Caddy Reverse Proxy"
	case "php-cgi":
		return "PHP CGI"
	case "mysql":
		return "MySQL Server"
	case "postgres":
		return "PostgreSQL"
	case "redis":
		return "Redis"
	default:
		return id
	}
}

func servicePortLabel(id string) string {
	switch id {
	case "dns-resolver":
		return "53"
	case "embedded-smtp":
		return "1025"
	case "embedded-dump-server":
		return "9912"
	case "caddy-proxy":
		return "80, 443"
	case "php-cgi":
		return "9074"
	case "mysql":
		return "3306"
	case "postgres":
		return "5432"
	case "redis":
		return "6379"
	default:
		return ""
	}
}

func sendAboutSync(conn *websocket.Conn) {
	payload, err := json.Marshal(map[string]interface{}{
		"event": "about_sync",
		"about": buildAboutPayload(),
	})
	if err == nil {
		_ = hub.Write(conn, payload)
	}
}

func broadcastAboutSync() {
	broadcastEvent("about_sync", map[string]interface{}{
		"about": buildAboutPayload(),
	})
}
