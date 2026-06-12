import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Mail,
  Server,
  Terminal,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { Separator } from "@/shared/ui/separator"
import type { AppNotification, NotificationCategory, NotificationType } from "@/shared/store/notifications"
import { formatFullTimestamp } from "@/shared/lib/mail"

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: typeof Info; label: string; badge: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  info: { icon: Info, label: "Info", badge: "secondary" },
  success: { icon: CheckCircle2, label: "Success", badge: "success" },
  warning: { icon: AlertTriangle, label: "Warning", badge: "warning" },
  error: { icon: XCircle, label: "Error", badge: "destructive" },
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  system: "System",
  mail: "Mail",
  service: "Service",
  dump: "Dump",
}

interface NotificationDetailDialogProps {
  notification: AppNotification | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDismiss?: () => void
}

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  onDismiss,
}: NotificationDetailDialogProps) {
  if (!notification) return null

  const config = TYPE_CONFIG[notification.type]
  const Icon = config.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={config.badge}>{config.label}</Badge>
            <Badge variant="outline">{CATEGORY_LABELS[notification.category]}</Badge>
            {!notification.read && (
              <Badge variant="default" className="bg-blue-600">Unread</Badge>
            )}
          </div>
          <DialogTitle className="flex items-start gap-2 pr-6">
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${
              notification.type === "success" ? "text-emerald-500"
              : notification.type === "error" ? "text-red-500"
              : notification.type === "warning" ? "text-amber-500"
              : "text-blue-500"
            }`} />
            {notification.title}
          </DialogTitle>
          <DialogDescription>{formatFullTimestamp(notification.timestamp)}</DialogDescription>
        </DialogHeader>

        {notification.message && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Details</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {notification.message}
              </p>
            </div>
          </>
        )}

        <Separator />

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt className="text-zinc-400 font-medium">ID</dt>
          <dd className="font-mono text-zinc-600 dark:text-zinc-400 break-all">{notification.id}</dd>
          <dt className="text-zinc-400 font-medium">Category</dt>
          <dd className="text-zinc-700 dark:text-zinc-300 capitalize">{notification.category}</dd>
          <dt className="text-zinc-400 font-medium">Status</dt>
          <dd className="text-zinc-700 dark:text-zinc-300">{notification.read ? "Read" : "Unread"}</dd>
        </dl>

        <DialogFooter className="gap-2 sm:gap-0">
          {onDismiss && (
            <Button variant="outline" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case "mail": return Mail
    case "dump": return Terminal
    default: return Server
  }
}
