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

> [!IMPORTANT]
> **User Review Required:** Please review Phase 6. For the tunnels, I am proposing Cloudflare Quick Tunnels because they are highly reliable and require no user account for basic usage. If you approve this approach, I will create the tracking tasks and execute these features immediately.

---

## 🎨 Phase 7: The Tauri Frontend (Premium Dashboard)

Now that the Go backend orchestrator is bulletproof, we will build the desktop UI using **Tauri v2, React, TypeScript, and TailwindCSS**. 

### The "Sidecar" Architecture
Since Tauri is built on Rust and our core is built in Go, we will use Tauri's **Sidecar** pattern.
1. The user launches `DevNest.exe` (The Tauri GUI).
2. Tauri seamlessly boots our compiled Go `daemon` as a hidden background sidecar.
3. The React frontend connects to `ws://127.0.0.1:9090/ws` to stream the telemetry, dump payloads, and emails.

### Tech Stack & Design Requirements
- **Framework:** Vite + React + TypeScript.
- **Styling:** Tailwind CSS with a stunning, premium aesthetic (Dark mode, glassmorphism, micro-interactions).
- **Animations:** Framer Motion for smooth tab transitions and live metric graphing.
- **Directory Structure:** We will scaffold the React app into a `frontend/` directory and initialize Tauri in `src-tauri/`, keeping it cleanly separated from our Go `pkg/` and `cmd/` directories.

> [!IMPORTANT]
> **User Review Required:** We are about to scaffold the Tauri frontend. I will use `npm create tauri-app@latest` and configure it for React + TypeScript + Tailwind. Do you approve of using the Tauri Sidecar approach to bundle our Go daemon, and the proposed modern tech stack?
