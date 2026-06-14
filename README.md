# DevNest

Local development orchestrator — mail trap, dump server, `.test` DNS, and a desktop dashboard. Built with Go (daemon), React (UI), and Tauri (desktop shell).

**License:** [MIT](LICENSE) — free and open source.

## Download (recommended)

1. Visit **[devnest.dev](https://devnest.dev)** or get the latest **Windows installer** from [GitHub Releases](https://github.com/khayson/DevNest/releases/latest) (`DevNest_*_x64-setup.exe`).
2. Run the installer and complete the **first-launch setup wizard**.
3. Pin DevNest from the Start Menu.

Updates: **About → Check for updates** in the desktop app, or download a newer release.

See [DISTRIBUTION.md](DISTRIBUTION.md) for maintainers (signing keys, CI, `latest.json`).

## Quick start (developers)

If you're building from source:

The desktop app automatically:

- Installs a background control service to `%USERPROFILE%\.devnest\bin\`
- Registers that service at Windows login (so the UI can always start the daemon)
- Starts the Go daemon when you open DevNest

**Build the installer locally:**

```powershell
.\scripts\release.ps1
```

**Dev shortcut (builds once if needed):** double-click `scripts\Open-DevNest.vbs`.

### Manage the environment from the app

On **General**:

- **Start daemon** — when the daemon is offline
- **Restart environment** — same as stop-daemon + start (full reset)
- **Stop environment** — stops daemon, Caddy, mail, dump, and PHP ports
- **Start all / Stop all** — individual services inside a running daemon

### Optional: developers

Contributors can still use scripts (`dev.ps1`, `dev-tauri.ps1`) or CLI (`devnest start|stop|status`).

## Test mail capture

With the daemon running:

```powershell
# Single Laravel-style email
.\scripts\send-test-mail.ps1

# Load test: 10, 20, or 50 varied messages (password reset, verify email, orders, etc.)
.\scripts\send-test-mail.ps1 -Count 20
```

## Test dump capture

With the daemon running:

```powershell
# Single VarDumper-style dump
.\scripts\send-test-dump.ps1

# Load test: arrays, Eloquent models, ValidationException, etc.
.\scripts\send-test-dump.ps1 -Count 50
```

## Test log streaming

With the daemon running:

```powershell
# Append Laravel-style lines to the DevNest daemon log
.\scripts\send-test-log.ps1 -Count 10

# Target Caddy or a Laravel project log
.\scripts\send-test-log.ps1 -Target caddy -Count 5
.\scripts\send-test-log.ps1 -Target laravel -LaravelPath "C:\path\to\your\laravel-app" -Count 20
```

## Local DNS resolver

DevNest runs a tiny DNS server on **127.0.0.1:53** that resolves any `*.test` hostname to **127.0.0.1**. That lets you open `https://myapp.test` in the browser without editing `hosts` for every site — Caddy then terminates TLS and proxies to your app.

On Windows, binding port 53 often requires **admin** (or another DNS already using that port). If DNS shows as stopped, DevNest automatically falls back to writing `127.0.0.1` entries in your system **hosts file** for each registered `*.test` site (including aliases). You can also run the daemon elevated if you prefer DNS on port 53.

## Desktop app (Tauri)

Build the daemon sidecar and launch the native window:

```powershell
.\scripts\dev-tauri.ps1
```

The Tauri shell auto-starts the Go daemon if port 9090 is not already in use. For browser-only development, use `.\scripts\dev.ps1` instead.

## Caddy (local sites)

DevNest generates a Caddyfile from sites you add in the **Sites** tab. Install Caddy first:

```powershell
.\scripts\install-caddy.ps1
```

This tries `winget install CaddyServer.Caddy`, then downloads Caddy to `~/.devnest/runtimes/caddy/` if winget fails.

## PHP (Laravel sites)

DevNest discovers PHP on PATH or in `~/.devnest/runtimes/php/`, runs **php-cgi** on port **9074**, and configures Caddy with `php_fastcgi` when a site folder contains `public/index.php`.

```powershell
.\scripts\install-php.ps1
```

Restart the daemon, pick the active version in the **PHP** tab, and start **PHP CGI** from **Services**.

## Databases

DevNest discovers **mysqld**, **postgres**, and **redis-server** on PATH or in `~/.devnest/runtimes/`. On Windows it also checks common XAMPP/Laragon MySQL paths.

Open the **Databases** tab to start/stop servers, copy connection strings, scan registered sites for `database/database.sqlite`, and run `php artisan migrate` / `migrate:fresh --seed`.

| Service | Default port | Connection (local dev) |
|---------|--------------|------------------------|
| MySQL | 3306 | `mysql://root@127.0.0.1:3306/devnest` |
| MariaDB | 3307 | `mysql://root@127.0.0.1:3307/devnest` |
| PostgreSQL | 5432 | `postgresql://devnest@127.0.0.1:5432/devnest` |
| Redis | 6379 | `redis://127.0.0.1:6379` |
| Valkey | 6380 | `redis://127.0.0.1:6380` |

If you use XAMPP, MySQL is usually detected automatically at `C:\xampp\mysql\bin\mysqld.exe`. Restart the daemon after installing database binaries.

## Verify everything works

With the daemon running:

```powershell
.\scripts\smoke-test.ps1
```

This checks ports (9090, 1025, 9912, Caddy), sends test mail and dump payloads, and prints a pass/fail summary. Then confirm in the UI:

| Check | Expected |
|-------|----------|
| **General** services tile | Same count as **Services** (e.g. 5/5 when PHP is installed) |
| **Mail** tab | Test email from smoke test |
| **Dumps** tab | Test dump after clicking Sync |
| **Sites** | Add site → Caddy reloads → site URL loads |

## Stop the daemon

If you get `bind: Only one usage of each socket address` on port 1025 or 2019, a stale process is still running. Stop everything first:

```powershell
.\scripts\stop-daemon.ps1
```

This frees ports **9090, 2019, 80, 1025, 9912, 9074, and 53** (daemon + Caddy + mail + dump + PHP + DNS).

Do **not** run `go run . daemon` in a second terminal while `dev.ps1` is active — one daemon is enough.

Then open the **Mail** tab in the dashboard.

## What works today

| Feature | Status |
|---------|--------|
| WebSocket daemon | Live |
| Mail interceptor (port 1025) | Live |
| Dump server (port 9912) | Live — inbox sync + UI |
| DNS resolver (`.test` → 127.0.0.1, port 53) | Live (may need admin on Windows) |
| Tauri desktop shell | Live — sidecar spawns daemon |
| Caddy reverse proxy + Sites | Live — requires Caddy binary on PATH |
| PHP discovery + php-cgi (port 9074) | Live — Laravel sites use php_fastcgi |
| General settings (theme, auto-start) | Live |
| Log aggregator (DevNest, Caddy, Laravel) | Live — WebSocket tail + source filter |
| Sites CRUD + Caddy routes + Laravel php_fastcgi | Live |
| MySQL / PostgreSQL / Redis service managers | Live — when binaries are installed (e.g. XAMPP MySQL) |
| SQLite scan + artisan migrations from Databases tab | Live — requires PHP |
| Queue workers (per-site queue:work) | Live — reads QUEUE_CONNECTION from .env |
| Task scheduler (per-site schedule:work) | Live — run now via schedule:run |
| Node.js discovery + npm run dev per site | Live — Vite/frontend projects with dev script |
| Installs tab — download Caddy, Node, cloudflared, MariaDB | Live (Windows) |
| `devnest.yml` site manifest (import on link/park) | Live |
| Laravel Forge integration + MCP (Cursor stdio) | Live |
| Per-version php.ini overrides | Live |
| `devnest start` / `stop` / `status` CLI | Live |
| Hosts-file fallback when DNS :53 unavailable | Live |

## Project layout

```text
backend/     Go daemon and service managers
frontend/    React + Vite dashboard
scripts/     Dev and test helpers
test.html    Standalone WebSocket test page
```

See [implementation_plan.md](implementation_plan.md) for the full product roadmap.

## UI components (shadcn/ui)

The frontend uses [shadcn/ui](https://ui.shadcn.com/) — copy-paste Radix components styled with Tailwind. Config: `frontend/components.json`.

Add more components:

```powershell
cd frontend
npm run ui:add badge dialog sheet
```

Components live in `frontend/src/shared/ui/`.

- Go 1.22+
- Node.js 20+
- npm
