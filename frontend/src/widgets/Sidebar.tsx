import { useEffect, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { getPageMeta, STATUS_STYLES, type PageStatus } from "@/shared/lib/navigation"
import {
  SIDEBAR_NAVIGATION,
  type SidebarNavItem,
} from "@/shared/lib/sidebar-navigation"
import { useSidebarBadges } from "@/shared/lib/sidebar-badges"
import { SidebarNavBadge } from "@/shared/ui/sidebar-nav-badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { APP_VERSION } from "@/shared/lib/version"

import { LIVE_SERVICE_IDS, countRunningServices } from "@/shared/lib/live-services"

const COLLAPSE_KEY = "devnest-sidebar-collapsed"

interface SidebarProps {
  activeView: string
  setActiveView: (view: string) => void
}

function PreviewDot({ status }: { status: PageStatus }) {
  if (status === "live") return null
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_STYLES[status].dot)}
      title={status === "mock" ? "Preview" : "Partial"}
    />
  )
}

function NavItemButton({
  item,
  isActive,
  collapsed,
  badge,
  onSelect,
}: {
  item: SidebarNavItem
  isActive: boolean
  collapsed: boolean
  badge: ReturnType<typeof useSidebarBadges>[string]
  onSelect: () => void
}) {
  const meta = getPageMeta(item.id)
  const Icon = item.icon

  const button = (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center rounded-lg text-left transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-2",
        isActive
          ? "bg-sidebar-active text-sidebar-active-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-none"
          : "text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground"
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn(
            collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
            isActive ? "text-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground"
          )}
          strokeWidth={isActive ? 2.25 : 2}
        />
        {collapsed && (
          <SidebarNavBadge badge={badge} isActive={isActive} placement="icon" collapsed />
        )}
      </span>

      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] leading-tight">
            {item.name}
          </span>
          {meta && meta.status !== "live" && <PreviewDot status={meta.status} />}
          <SidebarNavBadge badge={badge} isActive={isActive} placement="inline" />
        </>
      )}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        className="border-zinc-700 bg-zinc-900 text-zinc-50 max-w-[220px]"
      >
        <p className="font-medium">{item.name}</p>
        {meta && (
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{meta.description}</p>
        )}
        {badge && (
          <p className="mt-1 text-[11px] capitalize text-amber-300">{badge.hint}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarStatus({ collapsed }: { collapsed: boolean }) {
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const serviceStates = useTelemetryStore((s) => s.services)
  const runningCount = countRunningServices(serviceStates)
  const total = LIVE_SERVICE_IDS.length

  const inner = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2",
        collapsed && "justify-center px-2",
        isConnected
          ? "border-emerald-500/15 bg-emerald-500/[0.07]"
          : "border-red-500/20 bg-red-500/[0.07]"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isConnected ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-red-500"
        )}
      />
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight text-sidebar-foreground">
            {isConnected ? "Daemon online" : "Daemon offline"}
          </p>
          <p className="truncate text-[10px] leading-tight text-sidebar-muted">
            {isConnected
              ? `${runningCount}/${total} services`
              : "Not connected"}
          </p>
        </div>
      )}
    </div>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="border-zinc-700 bg-zinc-900 text-zinc-50">
          {isConnected ? "Daemon online" : "Daemon offline"}
        </TooltipContent>
      </Tooltip>
    )
  }

  return inner
}

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const badges = useSidebarBadges()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "true"
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed))
    } catch {
      /* ignore */
    }
  }, [collapsed])

  return (
    <aside
      className={cn(
        "sidebar-shell flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-sidebar-border/70",
          collapsed ? "justify-center px-2 py-4" : "gap-2.5 px-4 py-4"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF4433] to-[#D92D20] text-sm font-black text-white shadow-sm">
          D
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-sidebar-foreground">DevNest</p>
            <p className="truncate text-[10px] text-sidebar-muted">Local development</p>
          </div>
        )}
      </div>

      {/* Nav — flat Herd / macOS Settings list */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3 custom-scrollbar",
          collapsed ? "px-1.5" : "px-2"
        )}
        aria-label="Main navigation"
      >
        {SIDEBAR_NAVIGATION.map((section, sectionIdx) => (
          <div
            key={section.title}
            className={cn(sectionIdx > 0 && (collapsed ? "mt-2 pt-2 border-t border-sidebar-border/60" : "mt-3"))}
          >
            {!collapsed && (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/90">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <NavItemButton
                    item={item}
                    isActive={activeView === item.id}
                    collapsed={collapsed}
                    badge={badges[item.id]}
                    onSelect={() => setActiveView(item.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "shrink-0 space-y-2 border-t border-sidebar-border/70 p-2",
          collapsed && "px-1.5"
        )}
      >
        <SidebarStatus collapsed={collapsed} />

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "flex w-full items-center rounded-lg text-sidebar-muted transition-colors",
            "hover:bg-sidebar-hover hover:text-sidebar-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            collapsed ? "justify-center p-2" : "gap-2 px-2.5 py-2 text-[12px]"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Collapse sidebar</span>
              <span className="text-[10px] tabular-nums text-sidebar-muted/70">v{APP_VERSION}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
