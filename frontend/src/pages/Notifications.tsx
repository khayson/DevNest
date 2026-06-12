import { useState } from "react"
import { motion } from "framer-motion"
import {
  Bell,
  CheckCheck,
  Trash2,
  ChevronLeft,
  Inbox,
  Filter,
} from "lucide-react"
import {
  useNotificationStore,
  type AppNotification,
  type NotificationCategory,
} from "@/shared/store/notifications"
import { formatRelativeTime, formatFullTimestamp } from "@/shared/lib/mail"
import { NotificationDetailDialog, getCategoryIcon } from "@/shared/ui/notification-detail-dialog"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Separator } from "@/shared/ui/separator"
import { Input } from "@/shared/ui/input"

interface NotificationsProps {
  onBack?: () => void
}

export function Notifications({ onBack }: NotificationsProps) {
  const notifications = useNotificationStore((s) => s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearNotifications = useNotificationStore((s) => s.clearNotifications)
  const dismissNotification = useNotificationStore((s) => s.dismissNotification)
  const unread = useNotificationStore(
    (s) => s.notifications.filter((n) => !n.read).length
  )

  const [selected, setSelected] = useState<AppNotification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | "all">("all")

  const filtered = notifications.filter((n) => {
    const q = search.toLowerCase()
    const matchesSearch =
      n.title.toLowerCase().includes(q) ||
      (n.message?.toLowerCase().includes(q) ?? false)
    const matchesCategory = categoryFilter === "all" || n.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const openDetail = (n: AppNotification) => {
    setSelected(n)
    markRead(n.id)
    setDetailOpen(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="h-full flex flex-col min-h-0 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Notifications
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Full history of daemon events, mail captures, and service actions.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearNotifications} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as NotificationCategory | "all")}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All categories</option>
            <option value="system">System</option>
            <option value="mail">Mail</option>
            <option value="service">Service</option>
            <option value="dump">Dump</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Badge variant="outline" className="gap-1">
          <Inbox className="h-3 w-3" />
          {filtered.length} shown
        </Badge>
        {unread > 0 && <span>{unread} unread</span>}
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 divide-y divide-zinc-200 dark:divide-zinc-800">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No notifications</p>
          </div>
        ) : (
          filtered.map((n) => {
            const CatIcon = getCategoryIcon(n.category)
            return (
              <button
                key={n.id}
                onClick={() => openDetail(n)}
                className={`w-full text-left px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors flex gap-3
                  ${!n.read ? "bg-blue-50/50 dark:bg-blue-950/15" : ""}`}
              >
                {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                <div className={`mt-1 h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 ${!n.read ? "" : "ml-5"}`}>
                  <CatIcon className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{n.title}</p>
                    <span className="text-[10px] text-zinc-400 shrink-0">{formatRelativeTime(n.timestamp)}</span>
                  </div>
                  {n.message && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <p className="text-[10px] text-zinc-400 mt-1">{formatFullTimestamp(n.timestamp)}</p>
                </div>
              </button>
            )
          })
        )}
      </div>

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
    </motion.div>
  )
}
