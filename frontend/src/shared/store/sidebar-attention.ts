import { create } from "zustand"

/** Pages where visiting clears the "new since last visit" counter. */
export const SEEN_TRACKED_PAGES = ["mail", "dumps"] as const

interface SidebarAttentionState {
  lastSeenAt: Partial<Record<string, number>>
  markSeen: (pageId: string) => void
}

export const useSidebarAttentionStore = create<SidebarAttentionState>((set) => ({
  lastSeenAt: {},
  markSeen: (pageId) =>
    set((state) => ({
      lastSeenAt: { ...state.lastSeenAt, [pageId]: Date.now() },
    })),
}))

export function countUnseenSince(
  items: { timestamp: string }[],
  lastSeenAt: number | undefined
): number {
  if (items.length === 0) return 0
  const cutoff = lastSeenAt ?? 0
  return items.filter((item) => new Date(item.timestamp).getTime() > cutoff).length
}
