import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Bell, CheckCheck, Trash2, ChevronRight, ExternalLink } from "lucide-react"
import {
  useNotificationStore,
  type AppNotification,
} from "@/shared/store/notifications"
import { formatRelativeTime } from "@/shared/lib/mail"
import { NotificationDetailDialog, getCategoryIcon } from "@/shared/ui/notification-detail-dialog"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"

interface NotificationCenterProps {
  onViewAll?: () => void
}

export function NotificationCenter({ onViewAll }: NotificationCenterProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [selected, setSelected] = useState<AppNotification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; right: number }>({ top: 0, right: 16 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  const notifications = useNotificationStore((s) => s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearNotifications = useNotificationStore((s) => s.clearNotifications)
  const dismissNotification = useNotificationStore((s) => s.dismissNotification)
  const unread = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.read).length
  )

  const recent = notifications.slice(0, 8)

  useLayoutEffect(() => {
    if (!panelOpen || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      setPanelStyle({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [panelOpen])

  const openDetail = (n: AppNotification) => {
    setSelected(n)
    markRead(n.id)
    setDetailOpen(true)
    setPanelOpen(false)
  }

  const panel = panelOpen ? (
    <>
      <div
        className="fixed inset-0 z-[100]"
        onClick={() => setPanelOpen(false)}
        aria-hidden
      />
      <div
        style={{ top: panelStyle.top, right: panelStyle.right }}
        className={cn(
          "glass-dropdown fixed z-[101] w-[min(calc(100vw-2rem),380px)] overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-700/60"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/50 px-4 py-3 dark:border-zinc-700/50">
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Notifications</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {unread} unread · {notifications.length} total
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                title="Mark all read"
                className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900/5 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                title="Clear all"
                className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center text-zinc-500">
              <Bell className="mx-auto mb-2 h-7 w-7 opacity-30" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            recent.map((n) => {
              const CatIcon = getCategoryIcon(n.category)
              return (
                <button
                  key={n.id}
                  onClick={() => openDetail(n)}
                  className={cn(
                    "flex w-full gap-3 border-b border-zinc-200/40 px-4 py-3 text-left transition-colors last:border-0 dark:border-zinc-700/40",
                    "hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.06]",
                    !n.read && "bg-primary/[0.06] dark:bg-primary/[0.08]"
                  )}
                >
                  <div className="relative mt-0.5 shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/5 dark:bg-white/10">
                      <CatIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    {!n.read && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {formatRelativeTime(n.timestamp)}
                      </span>
                    </div>
                    {n.message && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {n.message}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-zinc-400" />
                </button>
              )
            })
          )}
        </div>

        {notifications.length > 0 && onViewAll && (
          <div className="border-t border-zinc-200/50 px-4 py-3 dark:border-zinc-700/50">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs font-semibold text-blue-600 dark:text-blue-400"
              onClick={() => {
                setPanelOpen(false)
                onViewAll()
              }}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View all notifications
            </Button>
          </div>
        )}
      </div>
    </>
  ) : null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setPanelOpen((v) => !v)}
        className="relative rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Notifications"
        aria-expanded={panelOpen}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {panelOpen && createPortal(panel, document.body)}

      <NotificationDetailDialog
        notification={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDismiss={
          selected
            ? () => {
                dismissNotification(selected.id)
                setDetailOpen(false)
              }
            : undefined
        }
      />
    </div>
  )
}
