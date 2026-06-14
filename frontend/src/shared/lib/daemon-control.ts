import { connectToDaemon } from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"
import { useTelemetryStore } from "@/shared/store/telemetry"

export const LAUNCHER_BASE = "http://127.0.0.1:9089"

export interface LauncherHealth {
  ok: boolean
  daemon_running: boolean
  launcher: boolean
}

export interface DaemonControlResult {
  success: boolean
  message?: string
}

export interface EnvironmentStatus {
  launcher: boolean
  daemon: boolean
  installed?: boolean
  error?: string
}

export function isTauriApp(): boolean {
  if (typeof window === "undefined") return false
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauriApp()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<T>(cmd, args)
  } catch (err) {
    console.warn(`[Tauri] ${cmd} failed:`, err)
    return null
  }
}

async function post(path: string): Promise<DaemonControlResult & Record<string, unknown>> {
  try {
    const resp = await fetch(`${LAUNCHER_BASE}${path}`, { method: "POST" })
    return await resp.json()
  } catch (err) {
    console.warn(`[Launcher] POST ${path} failed:`, err)
    return { success: false, message: err instanceof Error ? err.message : "Network error" }
  }
}

export async function fetchLauncherHealth(signal?: AbortSignal): Promise<LauncherHealth | null> {
  const timeout = signal ? undefined : AbortSignal.timeout(3000)
  try {
    const resp = await fetch(`${LAUNCHER_BASE}/api/health`, {
      signal: signal ?? timeout,
    })
    if (!resp.ok) return null
    return resp.json()
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null
    return null
  }
}

async function waitForLauncher(maxMs = 20000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const health = await fetchLauncherHealth()
    if (health?.ok) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

async function waitForDaemon(maxMs = 25000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const health = await fetchLauncherHealth()
    if (health?.daemon_running) return true
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

async function tryStartDaemonViaLauncher(): Promise<boolean> {
  const health = await fetchLauncherHealth()
  if (!health?.ok) return false
  if (health.daemon_running) return true
  await post("/api/daemon/start")
  return waitForDaemon(20000)
}

async function bootstrapViaTauri(): Promise<EnvironmentStatus | null> {
  await invokeTauri<string>("install_background_service_cmd")

  const deadline = Date.now() + 35000
  while (Date.now() < deadline) {
    const status = await invokeTauri<EnvironmentStatus>("ensure_environment_cmd")
    if (status?.daemon) {
      return { ...status, installed: status.installed ?? false }
    }

    if (status?.launcher) {
      const daemonUp = await tryStartDaemonViaLauncher()
      if (daemonUp) {
        return { launcher: true, daemon: true, installed: status.installed ?? false }
      }
    }

    await new Promise((r) => setTimeout(r, 1500))
  }

  const last = await invokeTauri<EnvironmentStatus>("ensure_environment_cmd")
  return last ? { ...last, installed: last.installed ?? false } : null
}

async function bootstrapViaHttp(): Promise<EnvironmentStatus> {
  let health = await fetchLauncherHealth()
  if (!health?.ok) {
    const ready = await waitForLauncher(20000)
    if (!ready) {
      return { launcher: false, daemon: false }
    }
    health = await fetchLauncherHealth()
  }

  if (health?.ok && !health.daemon_running) {
    await tryStartDaemonViaLauncher()
  }

  health = await fetchLauncherHealth()
  return {
    launcher: Boolean(health?.ok),
    daemon: Boolean(health?.daemon_running),
  }
}

/** Bootstraps launcher + daemon without a terminal (desktop app or installed background service). Never throws. */
export async function bootstrapDevNest(): Promise<EnvironmentStatus> {
  try {
    if (isTauriApp()) {
      const tauriStatus = await bootstrapViaTauri()
      if (tauriStatus?.daemon) return tauriStatus
      if (tauriStatus?.launcher) {
        return { ...tauriStatus, error: "Launcher is running but the daemon did not start in time" }
      }
    }

    const httpStatus = await bootstrapViaHttp()
    if (httpStatus.daemon) return httpStatus

    if (httpStatus.launcher) {
      return { ...httpStatus, error: "Launcher is running but the daemon did not start in time" }
    }

    return {
      launcher: false,
      daemon: false,
      error: isTauriApp()
        ? "Could not start DevNest background service — try Retry on the Environment step"
        : "DevNest background service is not running",
    }
  } catch (err) {
    console.error("[Bootstrap] unexpected error:", err)
    return {
      launcher: false,
      daemon: false,
      error: err instanceof Error ? err.message : "Bootstrap failed",
    }
  }
}

export async function startDaemonFromApp(): Promise<DaemonControlResult> {
  if (!isTauriApp()) {
    await bootstrapDevNest()
  }
  const health = await fetchLauncherHealth()
  if (!health?.ok) {
    if (isTauriApp()) {
      await invokeTauri<EnvironmentStatus>("ensure_environment_cmd")
    } else {
      return {
        success: false,
        message: "DevNest background service is not running. Open the DevNest desktop app.",
      }
    }
  }
  try {
    const data = await post("/api/daemon/start")
    if (data.success) {
      notify.success("Daemon started", "Connecting to ws://127.0.0.1:9090…", "system")
      connectToDaemon()
      return { success: true }
    }
    return { success: false, message: (data.message as string) || "Failed to start daemon" }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Network error" }
  }
}

export async function stopEnvironmentFromApp(): Promise<DaemonControlResult> {
  const health = await fetchLauncherHealth()
  if (!health?.ok) {
    if (isTauriApp()) {
      await invokeTauri<EnvironmentStatus>("ensure_environment_cmd")
    } else {
      return { success: false, message: "Control API is offline." }
    }
  }
  try {
    const data = await post("/api/daemon/stop")
    if (data.success) {
      useTelemetryStore.getState().setConnectionStatus(false)
      notify.info("Environment stopped", "Daemon and DevNest services were stopped.", "system")
      return { success: true }
    }
    return { success: false, message: (data.message as string) || "Stop failed" }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Network error" }
  }
}

export async function restartEnvironmentFromApp(): Promise<DaemonControlResult> {
  const health = await fetchLauncherHealth()
  if (!health?.ok && isTauriApp()) {
    await invokeTauri<EnvironmentStatus>("ensure_environment_cmd")
  } else if (!health?.ok) {
    return { success: false, message: "Open the DevNest desktop app to restart the environment." }
  }
  try {
    useTelemetryStore.getState().setConnectionStatus(false)
    const data = await post("/api/daemon/restart")
    if (data.success) {
      notify.success("Environment restarted", "Daemon is back online.", "system")
      connectToDaemon()
      return { success: true }
    }
    return { success: false, message: (data.message as string) || "Restart failed" }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Network error" }
  }
}

export async function gracefulShutdownDaemon(): Promise<DaemonControlResult> {
  const health = await fetchLauncherHealth()
  if (!health?.ok) {
    return { success: false, message: "Control API is offline." }
  }
  try {
    const data = await post("/api/daemon/shutdown")
    if (data.success) {
      useTelemetryStore.getState().setConnectionStatus(false)
      notify.info("Daemon stopped", "Graceful shutdown complete.", "system")
      return { success: true }
    }
    return { success: false, message: (data.message as string) || "Shutdown failed" }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Network error" }
  }
}
