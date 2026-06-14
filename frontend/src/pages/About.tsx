import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import {
  Heart,
  FolderOpen,
  Code2,
  Cpu,
  Copy,
  Check,
  RefreshCw,
  Server,
  Globe,
  Clock,
  HardDrive,
  RotateCcw,
  Compass,
} from "lucide-react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { useConfigStore } from "../shared/store/config"
import { useAboutStore, formatUptime, computeLiveUptime } from "../shared/store/about"
import { APP_VERSION, APP_CHANNEL, STACK } from "../shared/lib/version"
import { PAGE_META, STATUS_STYLES } from "../shared/lib/navigation"
import { syncAbout, openPath, resetFirstRun } from "../shared/api/ws"
import { checkForAppUpdates, RELEASES_URL } from "../shared/lib/app-updates"
import { copyToClipboard } from "../shared/lib/mail"
import { notify } from "../shared/store/notifications"
import { Badge } from "../shared/ui/badge"
import { Button } from "../shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../shared/ui/dialog"
import { cn } from "../shared/lib/utils"

const FEATURE_PAGES = [
  "general",
  "sites",
  "php",
  "services",
  "databases",
  "mail",
  "dumps",
  "logs",
  "node",
  "queues",
  "scheduler",
] as const

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function ServiceStateDot({ state }: { state: string }) {
  const color =
    state === "running"
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
      : state === "error"
        ? "bg-red-500"
        : state === "unavailable"
          ? "bg-amber-400"
          : "bg-zinc-400"
  return <span className={cn("w-2 h-2 rounded-full shrink-0", color)} />
}

export function About() {
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const about = useAboutStore((state) => state.about)
  const config = useConfigStore((state) => state.config)
  const [liveUptime, setLiveUptime] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    if (!about?.started_at) {
      setLiveUptime(about?.uptime_seconds ?? 0)
      return
    }
    const tick = () => setLiveUptime(computeLiveUptime(about.started_at))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [about?.started_at, about?.uptime_seconds])

  const daemonVersion = about?.daemon_version ?? "—"
  const goVersion = about?.go_version?.replace("go", "Go ") ?? "—"
  const platform = about ? `${about.os}/${about.arch}` : "—"

  const handleResetOnboarding = () => {
    setResetting(true)
    if (resetFirstRun()) {
      notify.success("Setup wizard reset", "The onboarding flow will appear again.", "system")
      setResetOpen(false)
    }
    setResetting(false)
  }

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true)
    const result = await checkForAppUpdates()
    setCheckingUpdate(false)
    if (result.status === "unavailable") {
      notify.error("Update check failed", result.message, "system")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            About DevNest
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Local development orchestrator — live system info from the Go daemon.
          </p>
        </div>
        <button
          type="button"
          onClick={() => syncAbout()}
          disabled={!isConnected}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">
        {/* Hero */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-6 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 rounded-xl shadow-sm">
          <div className="flex items-center space-x-5">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-extrabold shadow-lg shadow-blue-500/10">
              D
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 leading-tight">DevNest</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className="font-mono tabular-nums">
                  UI v{APP_VERSION}
                </Badge>
                {about && (
                  <Badge variant="outline" className="font-mono tabular-nums">
                    Daemon v{daemonVersion}
                  </Badge>
                )}
                <span className="text-xs text-zinc-400">({APP_CHANNEL})</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap lg:ml-auto gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm">
              <span
                className={cn(
                  "inline-block w-2.5 h-2.5 rounded-full",
                  isConnected ? "bg-emerald-500" : "bg-zinc-400"
                )}
              />
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                Daemon {isConnected ? "connected" : "offline"}
              </span>
            </div>
            {about && isConnected && (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span className="font-mono tabular-nums">{formatUptime(liveUptime)}</span>
                <span className="text-xs text-zinc-400">uptime</span>
              </div>
            )}
          </div>
        </div>

        {/* Live stats from daemon */}
        {about ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Server}
              label="Services"
              value={`${about.running_services}/${about.registered_services}`}
              sub="running / registered"
            />
            <StatCard
              icon={Globe}
              label="Sites"
              value={String(about.site_count)}
              sub="in registry"
            />
            <StatCard
              icon={Code2}
              label="PHP"
              value={about.php_installations > 0 ? String(about.php_installations) : "—"}
              sub={
                about.active_php_version
                  ? `Active ${about.active_php_version}`
                  : about.capabilities.php
                    ? "Not selected"
                    : "Not installed"
              }
            />
            <StatCard
              icon={HardDrive}
              label="Runtime"
              value={platform}
              sub={goVersion}
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-500 italic">
            {isConnected ? "Loading system info from daemon…" : "Start the daemon to see live system information."}
          </p>
        )}

        {/* Feature matrix */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Feature status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FEATURE_PAGES.map((pageId) => {
              const meta = PAGE_META[pageId]
              if (!meta) return null
              const styles = STATUS_STYLES[meta.status]
              return (
                <div
                  key={pageId}
                  className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 px-3 py-2.5"
                >
                  <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", styles.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                        {pageId.replace(/-/g, " ")}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border",
                          styles.badge
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{meta.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Daemon services */}
        {about && about.services.length > 0 && (
          <>
            <hr className="border-zinc-200 dark:border-zinc-800" />
            <div className="space-y-4">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Registered services</h3>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 text-[11px] font-semibold uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Port</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {about.services.map((svc) => (
                      <tr key={svc.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ServiceStateDot state={svc.state} />
                            <span className="text-xs font-medium capitalize text-zinc-600 dark:text-zinc-400">
                              {svc.state}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {svc.name}
                          {!svc.available && (
                            <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                              (binary missing)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500 hidden sm:table-cell">
                          {svc.port ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Paths */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Paths</h3>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {(about?.paths ?? []).map((row) => (
                  <tr key={row.label} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200 w-1/4 align-top">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500 break-all">{row.path || "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell align-top">{row.note}</td>
                    <td className="px-2 py-3 w-20">
                      <div className="flex items-center justify-end gap-0.5">
                        {row.path && <CopyButton value={row.path} />}
                        {row.path && (
                          <button
                            type="button"
                            onClick={() => openPath(row.path)}
                            disabled={!isConnected}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                            title="Open in Explorer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Endpoints</h3>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {(about?.endpoints ?? []).map((row) => (
                  <tr key={row.label} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200 w-1/4">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.address}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell">{row.note}</td>
                    <td className="px-2 py-3 w-10">
                      <CopyButton value={row.address} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Setup & updates */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Setup & updates</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                  <Compass className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">First-launch wizard</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {config?.first_run_completed
                      ? "Completed — re-run setup to walk through installs again."
                      : "Finish the wizard when it appears on launch."}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!isConnected}
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset onboarding
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                  <RefreshCw className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Updates</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    DevNest is free & open source (MIT). Check for updates or download the latest installer.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={checkingUpdate}
                  onClick={() => void handleCheckUpdates()}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", checkingUpdate && "animate-spin")} />
                  {checkingUpdate ? "Checking…" : "Check for updates"}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full text-xs" asChild>
                  <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                    Download from GitHub Releases
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Stack */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Built with</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StackTile icon={Cpu} label="Go daemon" value={about?.go_version?.replace("go", "") ?? STACK.go} />
            <StackTile icon={Code2} label="React" value={STACK.react} />
            <StackTile icon={FolderOpen} label="Tauri" value={STACK.tauri} />
            <StackTile icon={Server} label="Vite" value={STACK.vite} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 pb-4">
          <div className="flex items-center space-x-1.5 font-medium">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>for local PHP and web development.</span>
          </div>
          <span>
            DevNest {APP_VERSION}
            {about ? ` · daemon ${about.daemon_version}` : ""} — early development
          </span>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset onboarding?</DialogTitle>
            <DialogDescription>
              The setup wizard will appear again on your next visit. Your sites, installs, and services are not removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={resetting} onClick={handleResetOnboarding}>
              {resetting ? "Resetting…" : "Reset wizard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Server
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-3">
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-zinc-800 dark:text-zinc-200">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function StackTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cpu
  label: string
  value: string
}) {
  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1">
      <Icon className="w-4 h-4 mx-auto text-zinc-400 mb-1" />
      <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">{label}</span>
      <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">{value}</p>
    </div>
  )
}
