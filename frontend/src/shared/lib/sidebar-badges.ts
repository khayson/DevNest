import { useMemo } from "react"
import { useCapturedStore } from "@/shared/store/captured"
import { useNotificationStore } from "@/shared/store/notifications"
import {
  countUnseenSince,
  useSidebarAttentionStore,
} from "@/shared/store/sidebar-attention"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { LIVE_SERVICE_IDS } from "@/shared/lib/live-services"

export type SidebarBadgeTone = "danger" | "warning" | "info"

export interface SidebarBadge {
  count: number
  tone: SidebarBadgeTone
  /** Short phrase for tooltips, e.g. "2 new emails" */
  hint: string
}

function badge(
  count: number,
  tone: SidebarBadgeTone,
  hint: string
): SidebarBadge | null {
  if (count <= 0) return null
  return { count, tone, hint }
}

function countUnreadByCategory(
  notifications: { read: boolean; category: string }[]
) {
  let mail = 0
  let dump = 0
  let service = 0
  let system = 0
  for (const n of notifications) {
    if (n.read) continue
    switch (n.category) {
      case "mail":
        mail++
        break
      case "dump":
        dump++
        break
      case "service":
        service++
        break
      case "system":
        system++
        break
    }
  }
  return { mail, dump, service, system }
}

export function useSidebarBadges(): Record<string, SidebarBadge | null> {
  const lastSeenMail = useSidebarAttentionStore((s) => s.lastSeenAt.mail)
  const lastSeenDumps = useSidebarAttentionStore((s) => s.lastSeenAt.dumps)

  const isConnected = useTelemetryStore((s) => s.isConnected)
  const serviceStates = useTelemetryStore((s) => s.services)

  const emails = useCapturedStore((s) => s.emails)
  const dumps = useCapturedStore((s) => s.dumps)
  const notifications = useNotificationStore((s) => s.notifications)

  return useMemo(() => {
    const unreadNotifications = notifications.filter((n) => !n.read).length
    const unreadByCategory = countUnreadByCategory(notifications)

    const unseenMail = countUnseenSince(emails, lastSeenMail)
    const unseenDumps = countUnseenSince(dumps, lastSeenDumps)

    const stoppedServices = isConnected
      ? LIVE_SERVICE_IDS.filter((id) => serviceStates[id]?.state !== "running").length
      : 0

    const mailAttention = unseenMail + unreadByCategory.mail
    const dumpAttention = unseenDumps + unreadByCategory.dump
    const serviceAttention = stoppedServices + unreadByCategory.service

    return {
      general: isConnected
        ? badge(unreadByCategory.system, "danger", "unread system alerts")
        : badge(1, "danger", "daemon offline"),
      services: badge(
        serviceAttention,
        stoppedServices > 0 ? "warning" : "danger",
        stoppedServices > 0
          ? `${stoppedServices} service${stoppedServices === 1 ? "" : "s"} stopped`
          : "unread service alerts"
      ),
      mail: badge(
        mailAttention,
        "info",
        unseenMail > 0
          ? `${unseenMail} new email${unseenMail === 1 ? "" : "s"}`
          : "unread mail alerts"
      ),
      dumps: badge(
        dumpAttention,
        "info",
        unseenDumps > 0
          ? `${unseenDumps} new dump${unseenDumps === 1 ? "" : "s"}`
          : "unread dump alerts"
      ),
      notifications: badge(
        unreadNotifications,
        "danger",
        `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}`
      ),
    }
  }, [
    lastSeenMail,
    lastSeenDumps,
    emails,
    dumps,
    notifications,
    isConnected,
    serviceStates,
  ])
}

export function formatBadgeCount(count: number): string {
  return count > 9 ? "9+" : String(count)
}
