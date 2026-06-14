import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Database,
  Globe,
  Loader2,
  Lock,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Wifi,
} from "lucide-react"
import {
  addStack,
  completeFirstRun,
  connectToDaemon,
  enableHostsFallback,
  installPHP,
  installRuntime,
  sendCommand,
  syncDatabases,
  syncStacks,
  trustLocalCA,
} from "@/shared/api/ws"
import { bootstrapDevNest, restartEnvironmentFromApp } from "@/shared/lib/daemon-control"
import { startServiceWithFeedback } from "@/shared/lib/service-actions"
import { useAboutStore } from "@/shared/store/about"
import { useConfigStore } from "@/shared/store/config"
import { useDatabasesStore } from "@/shared/store/databases"
import { useNodeStore } from "@/shared/store/node"
import { useOnboardingStore } from "@/shared/store/onboarding"
import { usePHPStore } from "@/shared/store/php"
import { useSitesStore } from "@/shared/store/sites"
import { useStacksStore } from "@/shared/store/stacks"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"

type StepId =
  | "welcome"
  | "connect"
  | "essentials"
  | "authorize"
  | "services"
  | "optional"

const STEPS: { id: StepId; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "connect", label: "Environment" },
  { id: "essentials", label: "Essentials" },
  { id: "authorize", label: "Permissions" },
  { id: "services", label: "Services" },
  { id: "optional", label: "Extras" },
]

const ESSENTIALS = [
  { id: "caddy", label: "Caddy", note: "HTTPS reverse proxy for *.test sites", kind: "runtime" as const },
  { id: "php", label: "PHP 8.3", note: "Laravel and PHP-FPM/CGI", kind: "php" as const },
  { id: "node", label: "Node.js", note: "Vite and frontend tooling", kind: "runtime" as const },
]

function StepIndicator({ current }: { current: StepId }) {
  const idx = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((step, i) => (
        <div
          key={step.id}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i <= idx ? "w-6 bg-violet-500" : "w-3 bg-zinc-200 dark:bg-zinc-700"
          )}
          title={step.label}
        />
      ))}
    </div>
  )
}

function StatusIcon({ ready, busy }: { ready: boolean; busy?: boolean }) {
  if (busy) return <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
  if (ready) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  return <div className="h-4 w-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
}

export function OnboardingWizard() {
  const [step, setStep] = useState<StepId>("welcome")
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const config = useConfigStore((s) => s.config)
  const updateSettings = useConfigStore((s) => s.updateSettings)
  const phpSync = usePHPStore((s) => s.sync)
  const nodeSync = useNodeStore((s) => s.sync)
  const about = useAboutStore((s) => s.about)
  const caddyAvailable = useSitesStore((s) => s.caddyAvailable)
  const services = useTelemetryStore((s) => s.services)
  const dbServices = useDatabasesStore((s) => s.services)
  const suggestedStacks = useStacksStore((s) => s.suggested)
  const runtimeInstall = useOnboardingStore((s) => s.runtimeInstall)
  const phpInstall = useOnboardingStore((s) => s.phpInstall)
  const caTrust = useOnboardingStore((s) => s.caTrust)
  const hostsFallback = useOnboardingStore((s) => s.hostsFallback)
  const clearRuntimeInstall = useOnboardingStore((s) => s.clearRuntimeInstall)
  const clearPHPInstall = useOnboardingStore((s) => s.clearPHPInstall)

  const [installing, setInstalling] = useState<string | null>(null)
  const [installQueue, setInstallQueue] = useState<Array<{ id: string; kind: "runtime" | "php" }>>([])
  const [authBusy, setAuthBusy] = useState<string | null>(null)
  const [servicesStarted, setServicesStarted] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [linkingStack, setLinkingStack] = useState(false)

  const mysqlInfo = dbServices.find((d) => d.id === "mysql")
  const mariadbInfo = dbServices.find((d) => d.id === "mariadb")
  const mysqlRunning = services["mysql"]?.state === "running"
  const mariadbRunning = services["mariadb"]?.state === "running"
  const mysqlStack = suggestedStacks.find((s) => s.binaries?.some((b) => b.service === "mysql"))

  const caddyReady = Boolean(about?.capabilities?.caddy || caddyAvailable)
  const phpReady = Boolean(phpSync?.php_available)
  const nodeReady = Boolean(nodeSync?.node_available)
  const essentialsReady = caddyReady && phpReady && nodeReady

  const launchAuthorized = config?.launch_on_startup ?? false
  const hostsAuthorized = config?.dns_use_hosts_fallback ?? false
  const caAuthorized = caTrust?.success === true

  const runningServices = useMemo(
    () => Object.values(services).filter((s) => s?.state === "running").length,
    [services]
  )

  const advance = useCallback((next: StepId) => setStep(next), [])

  useEffect(() => {
    if (step === "connect" && isConnected) {
      const t = window.setTimeout(() => advance("essentials"), 600)
      return () => window.clearTimeout(t)
    }
  }, [step, isConnected, advance])

  useEffect(() => {
    if (step === "services" && runningServices >= 3) {
      setServicesStarted(true)
    }
  }, [step, runningServices])

  const installEssential = async (id: string, kind: "runtime" | "php") => {
    setInstalling(id)
    if (kind === "php") {
      clearPHPInstall()
      installPHP("8.3.21")
    } else {
      clearRuntimeInstall()
      installRuntime(id)
    }
  }

  const refreshAfterInstall = () => {
    sendCommand("get_php", {}, { silent: true })
    sendCommand("get_about", {}, { silent: true })
    sendCommand("get_node", {}, { silent: true })
    sendCommand("get_sites", {}, { silent: true })
  }

  useEffect(() => {
    if (!installing) return
    if (installing === "php" && phpInstall) {
      setInstalling(null)
      if (phpInstall.success) refreshAfterInstall()
    } else if (installing !== "php" && runtimeInstall?.runtime === installing) {
      setInstalling(null)
      if (runtimeInstall.success) {
        refreshAfterInstall()
        syncDatabases()
        if (installing === "caddy") {
          restartEnvironmentFromApp()
        }
      }
    }
  }, [installing, phpInstall, runtimeInstall])

  useEffect(() => {
    if (installing || installQueue.length === 0) return
    const [next, ...rest] = installQueue
    setInstallQueue(rest)
    setInstalling(next.id)
    if (next.kind === "php") {
      clearPHPInstall()
      installPHP("8.3.21")
    } else {
      clearRuntimeInstall()
      installRuntime(next.id)
    }
  }, [installing, installQueue, clearPHPInstall, clearRuntimeInstall])

  const installAllMissing = () => {
    const queue: Array<{ id: string; kind: "runtime" | "php" }> = []
    if (!caddyReady) queue.push({ id: "caddy", kind: "runtime" })
    if (!phpReady) queue.push({ id: "php", kind: "php" })
    if (!nodeReady) queue.push({ id: "node", kind: "runtime" })
    setInstallQueue(queue)
  }

  const authorizeCA = () => {
    setAuthBusy("ca")
    trustLocalCA()
  }

  const authorizeHosts = () => {
    setAuthBusy("hosts")
    enableHostsFallback()
  }

  const authorizeLaunch = () => {
    setAuthBusy("launch")
    const next = { launch_on_startup: true, auto_start_services: true, theme: config?.theme ?? "system" as const }
    updateSettings(next)
    sendCommand("update_settings", next)
    setAuthBusy(null)
  }

  useEffect(() => {
    if (authBusy === "ca" && caTrust) setAuthBusy(null)
    if (authBusy === "hosts" && hostsFallback) setAuthBusy(null)
  }, [authBusy, caTrust, hostsFallback])

  const permissionsReady =
    caAuthorized && (hostsAuthorized || hostsFallback?.success) && launchAuthorized

  const startServices = async () => {
    setServicesStarted(false)
    if (!isConnected) {
      await bootstrapDevNest()
      connectToDaemon()
      await new Promise((r) => setTimeout(r, 1500))
    }
    if (!sendCommand("start_all")) {
      return
    }
  }

  useEffect(() => {
    if (step !== "optional" || !isConnected) return
    syncStacks()
    syncDatabases()
  }, [step, isConnected])

  const linkMysqlInstall = () => {
    if (!mysqlStack) return
    setLinkingStack(true)
    if (addStack({ root_path: mysqlStack.root_path, name: mysqlStack.name })) {
      syncDatabases()
    }
    setTimeout(() => setLinkingStack(false), 1500)
  }

  const startDbService = (serviceId: "mysql" | "mariadb") => {
    startServiceWithFeedback(serviceId)
  }

  const finish = () => {
    setFinishing(true)
    completeFirstRun()
    setFinishing(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex max-h-[min(720px,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">DevNest setup</span>
            </div>
            <StepIndicator current={step} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <motion.div key="welcome" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Welcome to DevNest
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Your local Laravel Herd-style environment — mail trap, dumps, HTTPS sites, and services —
                    managed entirely from this app. No terminal required.
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                    Open sites at <code className="font-mono text-xs">https://myapp.test</code>
                  </li>
                  <li className="flex items-start gap-2">
                    <Server className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                    One-click installs for Caddy, PHP, and Node
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                    Authorize HTTPS and hosts — we handle the rest
                  </li>
                </ul>
                <Button className="w-full" size="lg" onClick={() => advance("connect")}>
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === "connect" && (
              <motion.div key="connect" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-950/50">
                  {isConnected ? (
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  ) : (
                    <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {isConnected ? "Environment online" : "Starting DevNest…"}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {isConnected
                      ? "Daemon connected at ws://127.0.0.1:9090"
                      : "Launching background service and Go daemon. This usually takes a few seconds."}
                  </p>
                </div>
                {!isConnected && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Wifi className="h-3.5 w-3.5" />
                    Waiting for connection…
                  </div>
                )}
                {isConnected && (
                  <Button className="w-full" onClick={() => advance("essentials")}>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </motion.div>
            )}

            {step === "essentials" && (
              <motion.div key="essentials" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Install essentials</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    DevNest downloads these to <code className="font-mono text-xs">~/.devnest/</code> — click Authorize on each or install all at once.
                  </p>
                </div>
                <div className="space-y-2">
                  {ESSENTIALS.map((item) => {
                    const ready =
                      item.id === "caddy" ? caddyReady : item.id === "php" ? phpReady : nodeReady
                    const busy = installing === item.id
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.label}</p>
                          <p className="text-xs text-zinc-500">{item.note}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusIcon ready={ready} busy={busy} />
                          {!ready && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(installing)}
                              onClick={() => installEssential(item.id, item.kind)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Install
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  {!essentialsReady && (
                    <Button variant="secondary" className="flex-1" disabled={Boolean(installing)} onClick={installAllMissing}>
                      Install all missing
                    </Button>
                  )}
                  <Button className="flex-1" disabled={!essentialsReady && Boolean(installing)} onClick={() => advance("authorize")}>
                    {essentialsReady ? "Continue" : "Skip for now"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "authorize" && (
              <motion.div key="authorize" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Authorize permissions</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    DevNest needs your approval once. Click each button — no manual configuration.
                  </p>
                </div>
                <div className="space-y-2">
                  <AuthCard
                    icon={Lock}
                    title="Trust local HTTPS certificate"
                    description="Adds Caddy's root CA so https://*.test works without browser warnings."
                    done={caAuthorized}
                    busy={authBusy === "ca"}
                    onAuthorize={authorizeCA}
                  />
                  <AuthCard
                    icon={Globe}
                    title="Sync *.test domains to hosts"
                    description="Fallback when DNS port 53 is unavailable — maps your sites to 127.0.0.1."
                    done={hostsAuthorized || hostsFallback?.success === true}
                    busy={authBusy === "hosts"}
                    onAuthorize={authorizeHosts}
                  />
                  <AuthCard
                    icon={Rocket}
                    title="Start DevNest at sign-in"
                    description="Keeps the launcher ready so the app can start the daemon instantly."
                    done={launchAuthorized}
                    busy={authBusy === "launch"}
                    onAuthorize={authorizeLaunch}
                  />
                </div>
                <Button className="w-full" onClick={() => advance("services")}>
                  {permissionsReady ? "Continue" : "Continue anyway"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === "services" && (
              <motion.div key="services" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Start core services</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Mail trap, dump server, DNS/hosts, Caddy, and PHP — one click to bring everything online.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-5 text-center dark:border-zinc-800 dark:bg-zinc-800/40">
                  <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{runningServices}</p>
                  <p className="text-xs text-zinc-500">services running</p>
                </div>
                <Button className="w-full" variant={servicesStarted ? "outline" : "default"} onClick={() => void startServices()}>
                  {servicesStarted ? "Start again" : "Start all services"}
                </Button>
                <Button className="w-full" onClick={() => advance("optional")}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === "optional" && (
              <motion.div key="optional" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Optional extras</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Add databases and tunnels now, or skip and configure later in Installs and Databases.
                  </p>
                </div>
                <div className="space-y-2">
                  <OptionalExtraCard
                    icon={Database}
                    title="MySQL"
                    note={
                      mysqlInfo?.available
                        ? `Port ${mysqlInfo.port} — ${mysqlRunning ? "running" : "ready to start"}`
                        : mysqlStack
                          ? `${mysqlStack.name} detected at ${mysqlStack.root_path}`
                          : "Link XAMPP/Laragon or add an install folder in Installs"
                    }
                    ready={Boolean(mysqlInfo?.available && mysqlRunning)}
                    installed={Boolean(mysqlInfo?.available)}
                    busy={linkingStack}
                    primaryLabel={
                      mysqlInfo?.available
                        ? mysqlRunning
                          ? undefined
                          : "Start MySQL"
                        : mysqlStack
                          ? `Link ${mysqlStack.name}`
                          : undefined
                    }
                    onPrimary={
                      mysqlInfo?.available
                        ? mysqlRunning
                          ? undefined
                          : () => startDbService("mysql")
                        : mysqlStack
                          ? linkMysqlInstall
                          : undefined
                    }
                  />
                  <OptionalExtraCard
                    icon={Database}
                    title="MariaDB"
                    note={
                      mariadbInfo?.available
                        ? `Port ${mariadbInfo.port} — ${mariadbRunning ? "running" : "ready to start"}`
                        : "One-click install to ~/.devnest/runtimes/mariadb/"
                    }
                    ready={Boolean(mariadbInfo?.available && mariadbRunning)}
                    installed={Boolean(mariadbInfo?.available)}
                    busy={installing === "mariadb" || linkingStack}
                    primaryLabel={
                      mariadbInfo?.available
                        ? mariadbRunning
                          ? undefined
                          : "Start MariaDB"
                        : "Install MariaDB"
                    }
                    onPrimary={
                      mariadbInfo?.available
                        ? mariadbRunning
                          ? undefined
                          : () => startDbService("mariadb")
                        : () => installEssential("mariadb", "runtime")
                    }
                  />
                  <OptionalExtraCard
                    icon={Globe}
                    title="cloudflared"
                    note="Share local sites via Cloudflare tunnels from the Sites tab."
                    busy={installing === "cloudflared"}
                    primaryLabel="Install"
                    onPrimary={() => installEssential("cloudflared", "runtime")}
                  />
                </div>
                <Button className="w-full" size="lg" disabled={finishing} onClick={finish}>
                  {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Finish setup
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

function OptionalExtraCard({
  icon: Icon,
  title,
  note,
  ready,
  installed,
  busy,
  primaryLabel,
  onPrimary,
}: {
  icon: typeof Database
  title: string
  note: string
  ready?: boolean
  installed?: boolean
  busy?: boolean
  primaryLabel?: string
  onPrimary?: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
          {ready && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {installed && !ready && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Installed
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">{note}</p>
      </div>
      {primaryLabel && onPrimary && (
        <Button size="sm" variant="outline" disabled={busy} onClick={onPrimary}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryLabel}
        </Button>
      )}
    </div>
  )
}

function AuthCard({
  icon: Icon,
  title,
  description,
  done,
  busy,
  onAuthorize,
}: {
  icon: typeof Lock
  title: string
  description: string
  done: boolean
  busy?: boolean
  onAuthorize: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      {done ? (
        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={onAuthorize}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Authorize"}
        </Button>
      )}
    </div>
  )
}
