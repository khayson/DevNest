import { isTauriApp } from "@/shared/lib/daemon-control"
import { notify } from "@/shared/store/notifications"

export const RELEASES_URL = "https://github.com/khayson/DevNest/releases/latest"

export type UpdateCheckResult =
  | { status: "updated" }
  | { status: "current" }
  | { status: "browser" }
  | { status: "unavailable"; message: string }

/** Check for app updates (Tauri) or open GitHub Releases (browser). */
export async function checkForAppUpdates(): Promise<UpdateCheckResult> {
  if (!isTauriApp()) {
    window.open(RELEASES_URL, "_blank", "noopener,noreferrer")
    return { status: "browser" }
  }

  try {
    const { check } = await import("@tauri-apps/plugin-updater")
    const { relaunch } = await import("@tauri-apps/plugin-process")
    const update = await check()
    if (!update) {
      notify.info("Up to date", "You have the latest DevNest release.", "system")
      return { status: "current" }
    }
    notify.info("Update available", `Downloading DevNest ${update.version}…`, "system")
    await update.downloadAndInstall()
    await relaunch()
    return { status: "updated" }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update check failed"
    if (message.includes("pubkey") || message.includes("signature") || message.includes("404")) {
      window.open(RELEASES_URL, "_blank", "noopener,noreferrer")
      notify.info("Manual update", "Opening GitHub Releases — in-app updates activate after signed releases.", "system")
      return { status: "browser" }
    }
    return { status: "unavailable", message }
  }
}
