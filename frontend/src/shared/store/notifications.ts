import { toast } from "sonner"
import { create } from "zustand"

export type NotificationType = "info" | "success" | "warning" | "error"
export type NotificationCategory = "system" | "mail" | "service" | "dump"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message?: string
  category: NotificationCategory
  timestamp: string
  read: boolean
}

interface NotificationState {
  notifications: AppNotification[]
  push: (item: {
    type: NotificationType
    title: string
    message?: string
    category?: NotificationCategory
    toast?: boolean
    persist?: boolean
    duration?: number
  }) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearNotifications: () => void
  dismissNotification: (id: string) => void
  unreadCount: () => number
}

let notifCounter = 0

function showToast(type: NotificationType, title: string, message?: string, duration?: number) {
  const opts = { description: message, duration: duration ?? 4500 }
  switch (type) {
    case "success":
      toast.success(title, opts)
      break
    case "error":
      toast.error(title, opts)
      break
    case "warning":
      toast.warning(title, opts)
      break
    default:
      toast.info(title, opts)
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  push: ({ type, title, message, category = "system", toast: show = true, persist = true, duration }) => {
    if (persist) {
      const id = `notif-${++notifCounter}`
      set((state) => ({
        notifications: [
          {
            id,
            type,
            title,
            message,
            category,
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...state.notifications,
        ].slice(0, 100),
      }))
    }
    if (show) {
      showToast(type, title, message, duration)
    }
  },

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearNotifications: () => set({ notifications: [] }),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}))

export const notify = {
  info: (title: string, message?: string, category?: NotificationCategory) =>
    useNotificationStore.getState().push({ type: "info", title, message, category }),
  success: (title: string, message?: string, category?: NotificationCategory) =>
    useNotificationStore.getState().push({ type: "success", title, message, category }),
  warning: (title: string, message?: string, category?: NotificationCategory) =>
    useNotificationStore.getState().push({ type: "warning", title, message, category }),
  error: (title: string, message?: string, category?: NotificationCategory) =>
    useNotificationStore.getState().push({ type: "error", title, message, category }),
  toast: (title: string, message?: string, type: NotificationType = "info") =>
    showToast(type, title, message),
}
