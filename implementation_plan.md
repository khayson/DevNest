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

## 🎨 Phase 8: The Tauri Frontend (Execution Plan)

Now that the scaffolding and FSD folder structure are ready, we will build the UI.

### Step 1: Design System & Theming
- Configure **TailwindCSS** with a custom DevNest theme (deep dark slate, vivid purple/blue accents).
- Initialize **Shadcn UI** (Button, Input, Card, Table, Badge, ScrollArea).
- Set up **Framer Motion** for micro-interactions.

### Step 2: Global State & WebSocket Client
- Create a **Zustand** store (`useTelemetryStore`, `useServiceStore`, `useMailStore`).
- Implement the WebSocket client in `src/shared/api/ws.ts` to connect to our Go daemon (`ws://127.0.0.1:9090/ws`) and dispatch events to Zustand.

### Step 3: Layout (The Shell)
- **Sidebar:** Navigation links (Dashboard, Databases, Mail, Logs, Settings).
- **Header:** Global controls (Start All, Stop All), Daemon connection status indicator.

### Step 4: Core Views (The Enterprise Features)
- `[ ]` **Databases View:** Toggles for MySQL, PostgreSQL, Redis with dynamic port and status displays.
# Laravel Herd UI/UX Redesign Plan (Settings Window Overhaul)

The goal is to completely match the **Laravel Herd** Windows desktop application UI/UX. We are moving away from the compact tray-flyout layout and restoring the full **Settings Window** layout, which features a left sidebar for navigation and page-specific content tabs on the right.

## User Review Required
> [!IMPORTANT]
> - We will revert `tauri.conf.json` to configure a standard resizable desktop window (`960x650` px) with native OS window decorations (minimize/maximize/close) and titlebar.
> - The layout will feature a two-column design: a light/dark system-styled left sidebar (width: `220px`) and a content area on the right.
> - We will implement 8 distinct pages matching Herd's settings tabs: **General**, **Sites**, **PHP**, **Node**, **Services**, **Mail**, **Dumps**, and **Logs**.
> - The application will connect live to the Go backend daemon, displaying live service statuses, intercepted mails, and live variable dumps/logs.

## Proposed Changes

---

### 1. Tauri Configuration
#### [MODIFY] [tauri.conf.json](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src-tauri/tauri.conf.json)
- Revert the main window dimensions to `width: 960` and `height: 650`.
- Enable standard window decorations (`decorations: true`) and make the window resizable (`resizable: true`).
- Disable window transparency so it acts as a solid, system-native settings panel.

---

### 2. Main App Shell & State Management
#### [MODIFY] [App.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/App.tsx)
- Rebuild the core layout as a split-pane settings window.
- Render the `Sidebar` on the left and the active view on the right.
- Add page switching state (`activeView`).
- Maintain the live WebSocket connection to the Go daemon to poll service telemetry, listen for captured mails (`mail_captured`), and capture variable dumps (`dump_captured`).

---

### 3. Sidebar Component
#### [MODIFY] [Sidebar.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/widgets/Sidebar.tsx)
- Implement Herd's Windows-native sidebar look:
  - Gray sidebar background slightly contrasting with the white/dark content pane.
  - Large, clean vertical navigation tabs with system icons (settings, globe, server, terminal, envelope, database).
  - Selected tab styled with a premium system accent blue background and white text.
  - Sidebar items: **General**, **Sites**, **PHP**, **Node**, **Services**, **Mail**, **Dumps**, **Logs**, and **About**.

---

### 4. Tab Content Views

#### [NEW] [General.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/General.tsx)
- Shows General settings:
  - Startup behaviors (checkboxes: launch on login, auto-start services).
  - UI Theme toggle (System, Light, Dark).
  - Global status indicator: "DevNest is running." with a green indicator.
  - Large **Start All Services** and **Stop All Services** action buttons.

#### [NEW] [Sites.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Sites.tsx)
- A clean, spacious tabular list of local websites.
- Columns: Site Name, Path, URL (clickable link), PHP version pinned (e.g. 8.3), and SSL Lock icon status.
- Clicking on a row allows securing/unsecuring the site, opening the site folder, or opening in the browser.

#### [MODIFY] [Settings.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Settings.tsx) -> **PHP.tsx**
- Rename page to `PHP.tsx`.
- Displays installed/available PHP versions.
- Toggles to set the default global PHP version.
- Buttons to "Edit php.ini" or access configuration folders.

#### [NEW] [Node.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Node.tsx)
- Node Version Manager (nvm) interface.
- List installed Node versions (e.g., v18.16.0, v20.10.0, v22.2.0) with an active checkmark.
- Ability to select the system active version or add new versions.

#### [MODIFY] [Dashboard.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Dashboard.tsx) -> **Services.tsx**
- Replace the grid layout with a flat table matching Herd's Services view.
- Columns: Service Name (MySQL, PostgreSQL, Redis, MailHog, Caddy), Port, Status, and individual Start / Restart / Stop control buttons.

#### [MODIFY] [Mail.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Mail.tsx)
- Overhaul to a two-column Mail Interceptor interface:
  - Left pane: list of captured emails (subject, recipient, timestamp) received via WebSocket.
  - Right pane: beautiful email preview tab displaying HTML content, plaintext headers, and attachment tabs.

#### [NEW] [Dumps.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Dumps.tsx)
- Live variable dump console.
- Lists `dump()` outputs stream live from the backend.
- Displays file:line information (e.g. `routes/web.php:30`), timestamp, and syntax-highlighted collapsible variable tree.

#### [MODIFY] [Logs.tsx](file:///c:/Users/VICTUS/Desktop/DevNest/frontend/src/pages/Logs.tsx)
- Dropdown to select service log file (Caddy, PHP, MySQL, System).
- High-performance tail viewer displaying real-time server output.

---

## Verification Plan

### Automated & Manual Verification
- Visual comparison against Laravel Herd Windows application style guide and screenshots.
- Test responsive resizing of the window.
- Verify live WebSocket integrations (service status changes, intercepting mock mail, streaming variable dump calls).

## User Review Required
> [!IMPORTANT]
> **Desktop Native Shift:** Does the plan to wrap the UI in a frameless Tauri window, add a custom titlebar, and wire the buttons to physically control the Go backend address your concerns about the app feeling like a "toy"? 
> 
> Once approved, we will immediately boot the app via Tauri natively on your Windows machine, removing the web browser entirely!
