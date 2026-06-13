import {
  Play,
  Square,
  RefreshCw,
  Monitor,
  Sun,
  Moon,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Terminal,
  Wifi,
  WifiOff,
  Server,
  AlertCircle,
} from "lucide-react"
import { useState } from "react"
import { sendCommand, trustLocalCA } from "@/shared/api/ws"
import { startServiceWithFeedback } from "@/shared/lib/service-actions"
import { notify } from "@/shared/store/notifications"
import { copyToClipboard } from "@/shared/lib/mail"
import {
  LIVE_SERVICES,
  CONFIG_PATH,
  WS_ENDPOINT,
  DEV_SCRIPT,
  type LiveServiceDef,
  getServiceBrandStyle,
} from "@/shared/lib/live-services"
import { APP_VERSION } from "@/shared/lib/version"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings-group"
import { Switch } from "@/shared/ui/switch"
import { cn } from "@/shared/lib/utils"

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Cpu
  tone?: "default" | "success" | "warning" | "danger"
}) {
  const tones = {
    default: "border-border bg-muted/40",
    success: "border-emerald-500/20 bg-emerald-500/[0.06]",
    warning: "border-amber-500/20 bg-amber-500/[0.06]",
    danger: "border-red-500/20 bg-red-500/[0.06]",
  }

  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function StatusHero({
  isConnected,
  runningCount,
  cpuUsage,
  memoryRss,
}: {
  isConnected: boolean
  runningCount: number
  cpuUsage: number
  memoryRss: number
}) {
  const total = LIVE_SERVICES.length
  const allRunning = runningCount === total
  const progress = total > 0 ? (runningCount / total) * 100 : 0

  const daemonTone = !isConnected ? "danger" : allRunning ? "success" : runningCount > 0 ? "warning" : "default"
  const servicesTone = !isConnected ? "default" : allRunning ? "success" : runningCount === 0 ? "warning" : "default"

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-sm",
        !isConnected
          ? "border-red-500/25 bg-gradient-to-br from-red-500/[0.08] via-card to-card"
          : allRunning
            ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.06] via-card to-card"
            : "border-border bg-card"
      )}
    >
      <div className="p-5 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <h2 className="text-base font-semibold text-foreground">
                {isConnected ? "Daemon connected" : "Daemon offline"}
              </h2>
              <Badge variant={isConnected ? "success" : "destructive"} className="font-medium">
                {isConnected ? "Live" : "Unreachable"}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {isConnected
                ? allRunning
                  ? "All daemon services are running — mail, dumps, DNS, and Caddy are ready."
                  : runningCount > 0
                    ? `${runningCount} of ${total} services running — start the rest or use Start all below.`
                    : "Connected to the Go backend, but no services are running yet."
                : "The UI cannot reach ws://127.0.0.1:9090. Start the daemon from the project root to sync settings and services."}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              size="sm"
              className="w-full sm:w-auto"
              disabled={!isConnected}
              onClick={() => {
                if (sendCommand("start_all")) {
                  notify.info("Starting all services…", undefined, "service")
                }
              }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!isConnected || runningCount === 0}
              onClick={() => {
                if (sendCommand("stop_all")) {
                  notify.info("Stopping all services…", undefined, "service")
                }
              }}
            >
              <Square className="h-3.5 w-3.5" />
              Stop all
            </Button>
          </div>
        </div>

        {isConnected && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Service health</span>
              <span className="tabular-nums font-medium">
                {runningCount}/{total} running
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allRunning ? "bg-emerald-500" : runningCount > 0 ? "bg-amber-500" : "bg-zinc-400"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border bg-muted/20 p-4 sm:grid-cols-4">
        <StatTile
          label="Daemon"
          value={isConnected ? "Online" : "Offline"}
          icon={isConnected ? Wifi : WifiOff}
          tone={daemonTone}
        />
        <StatTile
          label="Services"
          value={`${runningCount}/${total}`}
          sub={allRunning ? "All running" : runningCount === 0 ? "None running" : "Partial"}
          icon={Server}
          tone={servicesTone}
        />
        <StatTile
          label="CPU"
          value={isConnected ? `${cpuUsage.toFixed(1)}%` : "—"}
          sub="Running services"
          icon={Cpu}
        />
        <StatTile
          label="Memory"
          value={isConnected ? `${memoryRss} MB` : "—"}
          sub="RSS total"
          icon={HardDrive}
        />
      </div>

      {!isConnected && <OfflineHelp />}
    </div>
  )
}

function OfflineHelp() {
  const [copied, setCopied] = useState(false)

  const copyScript = async () => {
    await copyToClipboard(DEV_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-t border-red-500/15 bg-red-500/[0.04] px-5 py-4">
      <div className="flex gap-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">How to connect</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground list-decimal list-inside">
              <li>Open a terminal at the DevNest project root</li>
              <li>Run the dev script (starts daemon + frontend)</li>
              <li>This page will reconnect automatically via WebSocket</li>
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono">
              <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {DEV_SCRIPT}
            </code>
            <Button size="sm" variant="outline" onClick={copyScript}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy command"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ServiceRow({
  service,
  isRunning,
  isConnected,
}: {
  service: LiveServiceDef
  isRunning: boolean
  isConnected: boolean
}) {
  const Icon = service.icon
  const brand = getServiceBrandStyle(service, isRunning)

  return (
    <div className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
            brand.bg,
            brand.border,
            brand.icon,
            isRunning && service.brand.active.glow
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{service.name}</p>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              :{service.port}
            </code>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{service.hint}</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            isRunning
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isRunning ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-zinc-400"
            )}
          />
          {isRunning ? "Running" : "Stopped"}
        </span>

        <div className="flex items-center gap-1">
          {!isRunning ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!isConnected}
              onClick={() => startServiceWithFeedback(service.id)}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={!isConnected}
                title="Restart"
                onClick={() => {
                  if (sendCommand("restart_service", { serviceId: service.id })) {
                    notify.info(`Restarting ${service.name}…`, undefined, "service")
                  }
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!isConnected}
                title="Stop"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (sendCommand("stop_service", { serviceId: service.id })) {
                    notify.info(`Stopping ${service.name}…`, undefined, "service")
                  }
                }}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ThemePicker({
  theme,
  disabled,
  onChange,
}: {
  theme: "system" | "light" | "dark"
  disabled: boolean
  onChange: (t: "system" | "light" | "dark") => void
}) {
  const options = [
    {
      id: "system" as const,
      label: "System",
      desc: "Match OS",
      icon: Monitor,
      preview: "from-zinc-300 via-zinc-200 to-zinc-100 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900",
    },
    {
      id: "light" as const,
      label: "Light",
      desc: "Always light",
      icon: Sun,
      preview: "from-white via-zinc-50 to-zinc-200",
    },
    {
      id: "dark" as const,
      label: "Dark",
      desc: "Always dark",
      icon: Moon,
      preview: "from-zinc-700 via-zinc-900 to-black",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
      {options.map(({ id, label, desc, icon: Icon, preview }) => {
        const selected = theme === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-primary shadow-sm ring-2 ring-primary/15"
                : "border-border hover:border-primary/40"
            )}
          >
            <div className={cn("h-16 bg-gradient-to-br", preview)} />
            <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function StartupSettings({
  isConnected,
  launchOnStartup,
  autoStartServices,
  onLaunchChange,
  onAutoStartChange,
}: {
  isConnected: boolean
  launchOnStartup: boolean
  autoStartServices: boolean
  onLaunchChange: (v: boolean) => void
  onAutoStartChange: (v: boolean) => void
}) {
  return (
    <SettingsGroup title="Startup" description="Control how DevNest launches on your machine.">
      <SettingsRow
        label="Launch DevNest at login"
        description="Registers a startup entry when using the desktop build (Windows)."
        disabled={!isConnected}
      >
        <Switch
          checked={launchOnStartup}
          disabled={!isConnected}
          onCheckedChange={onLaunchChange}
        />
      </SettingsRow>
      <SettingsRow
        label="Auto-start services"
        description="Start mail, dump server, and DNS when the daemon boots."
        disabled={!isConnected}
      >
        <Switch
          checked={autoStartServices}
          disabled={!isConnected}
          onCheckedChange={onAutoStartChange}
        />
      </SettingsRow>
    </SettingsGroup>
  )
}

function CopyableCode({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <code className="w-full break-all rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-foreground sm:w-auto">
        {value}
      </code>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 shrink-0 p-0"
        onClick={async () => {
          await copyToClipboard(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}

export function ConnectionPanel({ isConnected }: { isConnected?: boolean }) {
  return (
    <SettingsGroup
      title="Connection & storage"
      description="Paths and endpoints used by the UI and daemon."
    >
      <SettingsRow label="WebSocket endpoint" description="UI ↔ Go orchestrator">
        <CopyableCode value={WS_ENDPOINT} />
      </SettingsRow>
      <SettingsRow label="Config file" description="Theme, startup prefs, and site registry.">
        <CopyableCode value={CONFIG_PATH} />
      </SettingsRow>
      <SettingsRow label="App version">
        <Badge variant="secondary" className="font-mono tabular-nums">
          v{APP_VERSION}
        </Badge>
      </SettingsRow>
      <SettingsRow
        label="Dev script"
        description="Starts daemon and frontend together from project root."
      >
        <CopyableCode value={DEV_SCRIPT} />
      </SettingsRow>
      <SettingsRow
        label="Trust local HTTPS certificate"
        description="Adds Caddy's root CA to the system trust store so *.test sites open without browser warnings."
        disabled={!isConnected}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isConnected}
          onClick={() => {
            if (trustLocalCA()) {
              notify.info("Trusting certificate…", "Run Caddy at least once before trusting.", "system")
            }
          }}
        >
          Trust Caddy CA
        </Button>
      </SettingsRow>
    </SettingsGroup>
  )
}
