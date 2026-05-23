# Implementation Plan - DevNest Core Engine (Enterprise Grade)

DevNest aims to surpass Laravel Herd and its premium services by providing a highly robust, extensible, and developer-centric local development runtime. This updated plan details the enterprise-grade architecture, advanced features, and modular plugins required to exceed Herd Pro's capabilities.

---

## 🚀 How DevNest Will Surpass Laravel Herd Pro

| Feature | Laravel Herd Pro | **DevNest (Enterprise)** |
| :--- | :--- | :--- |
| **Process Model** | Monolithic process management | **Dynamic Micro-Orchestrator** with telemetry (CPU, RAM, connection tracking) |
| **Mail Trap** | Basic mail viewer | **Embedded Mailpit-compatible SMTP Server** with WebSockets and MIME analysis |
| **Debugging** | Basic Xdebug toggle | **Interactive Xdebug Profier** & Real-time `dd()` / Dump Server |
| **Database Manager**| Separate GUI links | **Embedded Adminer/PgLite/SQLite viewer** with schema visualization |
| **Expose / Tunnels** | Proprietary paid service | **Built-in open-source Tunnels** (Cloudflare Tunnels, LocalTunnel, SSH) |
| **Logs & Metrics** | Standard flat logs | **Structured Log Aggregator & Trace Viewer** (OpenTelemetry ready) |
| **Custom Services** | Hardcoded services | **Plugin Architecture** (Docker-like config, support for MinIO, Meilisearch, Redis) |

---

## Architecture Blueprint (Enterprise Ready)

```text
                               ┌────────────────────────┐
                               │   Tauri UI Dashboard   │
                               │  (React + Tailwind)    │
                               └───────────┬────────────┘
                                           │ JSON-RPC over WebSockets
                                           ▼
                               ┌────────────────────────┐
                               │  Go Core Orchestrator  │
                               │   (Telemetry Engine)   │
                               └─────┬────────────┬─────┘
                                     │            │
             ┌───────────────────────┘            └────────────────────────┐
             ▼                                                             ▼
     ┌──────────────┐                                              ┌──────────────┐
     │  OS Adapters │                                              │ Service Bus  │
     └──────┬───────┘                                              └──────┬───────┘
            ├─ Windows (Win32 API, Hosts, CA)                             ├─ PHP-FPM / php-cgi (FastCGI)
            ├─ macOS (Launchd, Keychain CA)                               ├─ Caddy (Reverse Proxy + Auto TLS)
            └─ Linux (Systemd, NSS certutil)                              ├─ Mail Server (Embedded SMTP)
                                                                          ├─ Dump Server (TCP Collector)
                                                                          └─ Database Engines
```

---

## Proposed Changes

### Project Layout (Enterprise modular structure)

```text
DevNest/
├── main.go               # Enterprise CLI / Daemon Bootstrapper
├── go.mod
├── cmd/                  # CLI commands & Daemon runner
│   ├── daemon.go         # Background daemon handling RPC & WebSockets
│   ├── start.go
│   ├── stop.go
│   └── service.go
└── pkg/
    ├── config/           # Secure config management (JSON / encrypted credentials)
    ├── telemetry/        # Performance tracking (CPU, RAM, Open Sockets) per process
    ├── os/               # Low-level OS capabilities (privileged helpers, local CA generation)
    ├── service/          # Service Engine (abstracts execution, environment, binary verification)
    │   ├── manager.go    # Orchestrates service state & health checks
    │   ├─- php/          # PHP config, versions, extensions (Xdebug)
    │   ├── caddy/        # Caddy dynamic JSON-config generator
    │   ├── mail/         # Embedded SMTP capture engine (Mailpit clone)
    │   └── dump/         # Embedded dd() dump server
    └── tunnel/           # Public HTTP tunnel integrations
```

---

## 🧩 Key Enterprise Abstractions

### 1. Dynamic Service Telemetry (`pkg/telemetry`)
Instead of just checking if a process is alive, DevNest will poll OS metrics to show developer resource consumption:
```go
type ProcessMetrics struct {
    PID           int32     `json:"pid"`
    CPUPercent    float64   `json:"cpu_percent"`
    MemoryBytes   uint64    `json:"memory_bytes"`
    UptimeSeconds int64     `json:"uptime_seconds"`
    OpenSockets   int       `json:"open_sockets"`
}
```

### 2. Service Management Interface
```go
type Service interface {
    ID() string
    Name() string
    Version() string
    Configure() error
    Start() error
    Stop() error
    HealthCheck() (HealthState, error)
    GetMetrics() (*ProcessMetrics, error)
}
```

### 3. Built-in Mail Capturer (`pkg/service/mail`)
A lightweight SMTP listener on port 1025. It parses incoming emails in real-time, stores them in an in-memory database, and broadcasts them via WebSocket to the UI dashboard.

### 4. Built-in Dump Server (`pkg/service/dump`)
A TCP socket listener (default port 9912) that integrates with Symfony/Laravel Dump Server. It intercepts payload output from `dump()` calls, format it to HTML/JSON, and forwards it instantly to the Tauri UI.

---

## Verification Plan

### Automated Tests
- Integration tests simulating SMTP mail sending and verifying WebSocket transmission.
- Dump server test simulating a payload dump and parsing the formatted output.
- Unit tests verifying dynamic Caddy configuration updates under high concurrency.
- Run tests via `go test -v ./...`.

### Manual Verification
- Verify local CA certificate generation and injection into Windows Trust Store.
- Boot the SMTP server, send a test mail via telnet/PHP `mail()`, and verify it appears in the logs.
- Boot the Dump server, send a payload, and print to console.

---

## 🛠️ Phase 5: "Solid Ground" Backend Finalization (Added)

To ensure the backend is fully standalone and robust before moving to the frontend, we must complete the OS integrations and dependency management natively.

### Proposed Additions:

#### [NEW] `pkg/os/hosts.go`
- Cross-platform helper to safely parse and append `.test` domains to `/etc/hosts` or `C:\Windows\System32\drivers\etc\hosts`.
- Requires elevation checking or Windows-specific permission handling.

#### [NEW] `pkg/installer/downloader.go` & `pkg/installer/extractor.go`
- HTTP client wrapped with progress-bar logic to securely download Caddy and PHP zip/tarball binaries from official sources.
- Native `archive/zip` and `archive/tar` extractors to populate `~/.devnest/runtimes/`.

#### [NEW] `pkg/config/store.go`
- A JSON/YAML file store (e.g., `~/.devnest/devnest.json`) to remember which PHP version is active, what projects are registered, and which ports are assigned.

#### Git Initialization
- `git init`, `.gitignore`, and commit the finalized Go backend as the baseline.

> [!IMPORTANT]
> **User Review Required:** Do these three components (Hosts management, Binary Downloader, Config Store) cover everything you need for the backend "solid ground", or is there another utility you'd like to bake in before we commit?

---

## 🏆 Phase 6: Advanced Enterprise Features (The Herd Killer)

To truly surpass Laravel Herd Pro, we must implement robust system-level features that make the environment resilient and externally accessible.

### Proposed Additions:

#### 1. Auto-Healing Process Supervisor
- **Component:** `pkg/service/php/server.go` & `pkg/service/caddy/server.go`
- **Logic:** Replace the simple `Wait()` goroutine with a supervisor loop. If a service exits with a non-zero code, it will automatically restart with an exponential backoff strategy, preventing silent environment crashes.

#### 2. Local CA Trust Store Injection
- **Component:** `pkg/os/cert.go`
- **Logic:** Caddy generates a local Root CA (`root.crt`) automatically. DevNest will locate this file (e.g., in `%AppData%\Caddy\pki\authorities\local\`) and run the Windows `certutil -addstore -f "Root"` command to inject it into the system trust store. This ensures `https://my-app.test` always has a green padlock without manual browser configuration.

#### 3. Public Tunnels (Expose Alternative)
- **Component:** `pkg/tunnel/manager.go`
- **Logic:** We will build a wrapper around Cloudflare's `cloudflared` binary (Quick Tunnels). It will allow developers to run a command/API call that spawns `cloudflared tunnel --url http://127.0.0.1:<port>`. Our engine will intercept the generated `trycloudflare.com` URL and broadcast it to the UI, providing a completely free alternative to Herd Pro's paid Expose service.

---

## 🏗️ Phase 7: Tier 1 & Tier 2 Enterprise Backend (Completed)

We implemented an extensive suite of background services:
- **Databases:** MySQL 8.0, PostgreSQL 16, Redis 7.0 managers with auto-healing.
- **Node.js:** Vite process supervisor (`npm run dev`) for modern frontend assets.
- **Log Aggregator:** `fsnotify`-based log watcher for streaming structured error logs to the UI.
- **DNS Resolver:** Embedded UDP DNS Server on port 53 mapping `*.test` to `127.0.0.1`.
- **Laravel specific:** Queue Worker supervisor, Cron Scheduler supervisor, Meilisearch server, MinIO (Local S3) server.
- **SQLite utility:** Auto-creating `database.sqlite` and running migrations.

---

## 🎨 Phase 8: The Tauri Frontend (Premium Dashboard)

Now that the Go backend orchestrator is bulletproof, we will build the desktop UI using **Tauri v2, React, TypeScript, and TailwindCSS**. 

### The "Sidecar" Architecture
Since Tauri is built on Rust and our core is built in Go, we will use Tauri's **Sidecar** pattern.
1. The user launches `DevNest.exe` (The Tauri GUI).
2. Tauri seamlessly boots our compiled Go `daemon` as a hidden background sidecar.
3. The React frontend connects to `ws://127.0.0.1:9090/ws` to stream the telemetry, dump payloads, and emails.

### 🌟 Killer Feature: Embedded SQLite Browser
Since **Laravel 11 / 13.x defaults to SQLite**, DevNest will include a built-in visual database browser directly in the Tauri UI. 
- You won't need to download DB Browser for SQLite or TablePlus.
- Click a project -> View Tables -> Run Queries -> Edit Rows instantly.
- One-click `php artisan migrate:fresh --seed` buttons for rapid local resetting.

### Tech Stack & Design Requirements
- **Framework:** Vite + React + TypeScript.
- **Styling:** Tailwind CSS with a stunning, premium aesthetic (Dark mode, glassmorphism, micro-interactions).
- **Animations:** Framer Motion for smooth tab transitions and live metric graphing.

> [!IMPORTANT]
> **User Review Required:** This represents the final feature breakdown! We have completed all backend work (and I just fixed the `go vet` import errors in MinIO and Meilisearch). Are you ready for me to scaffold the Tauri frontend using `npx create-tauri-app`, or is there anything else you'd like to add to this roadmap before we move to the UI?
