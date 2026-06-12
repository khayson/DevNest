import { formatBadgeCount, type SidebarBadge } from "@/shared/lib/sidebar-badges"
import { cn } from "@/shared/lib/utils"

const TONE_STYLES = {
  danger: "bg-red-500 text-white ring-2 ring-sidebar",
  warning: "bg-amber-500 text-white ring-2 ring-sidebar",
  info: "bg-primary text-primary-foreground ring-2 ring-sidebar",
} as const

interface SidebarNavBadgeProps {
  badge: SidebarBadge | null | undefined
  isActive: boolean
  placement?: "icon" | "inline"
  collapsed?: boolean
}

export function SidebarNavBadge({
  badge,
  isActive,
  placement = "icon",
  collapsed = false,
}: SidebarNavBadgeProps) {
  if (!badge || isActive) return null

  const label = formatBadgeCount(badge.count)

  if (placement === "icon") {
    if (!collapsed) return null
    return (
      <span
        className={cn(
          "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none shadow-sm",
          TONE_STYLES[badge.tone]
        )}
        aria-label={badge.hint}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
        TONE_STYLES[badge.tone]
      )}
      aria-label={badge.hint}
    >
      {label}
    </span>
  )
}
