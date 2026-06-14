import { useEffect, useState } from "react"
import { connectToDaemon } from "./shared/api/ws"
import { bootstrapDevNest } from "./shared/lib/daemon-control"
import { PageStatusBanner } from "./shared/ui/page-status-banner"
import { Toaster } from "./shared/ui/sonner"
import { NotificationCenter } from "./shared/ui/notification-center"
import { TooltipProvider } from "./shared/ui/tooltip"
import { useSidebarAttentionStore } from "./shared/store/sidebar-attention"
import { getPageMeta } from "./shared/lib/navigation"
import { getPageTitle, findNavItem } from "./shared/lib/sidebar-navigation"
import { Sidebar } from "./widgets/Sidebar"
import { General } from "./pages/General"
import { Sites } from "./pages/Sites"
import { Installs } from "./pages/Installs"
import { PHP } from "./pages/PHP"
import { Node } from "./pages/Node"
import { Services } from "./pages/Services"
import { Databases } from "./pages/Databases"
import { Queues } from "./pages/Queues"
import { Scheduler } from "./pages/Scheduler"
import { Mail } from "./pages/Mail"
import { Dumps } from "./pages/Dumps"
import { Logs } from "./pages/Logs"
import { About } from "./pages/About"
import { Notifications } from "./pages/Notifications"
import { cn } from "./shared/lib/utils"
import { OnboardingGate } from "./features/onboarding/onboarding-gate"

/** Pages that manage their own scroll regions — no outer page padding wrapper. */
const FULL_BLEED_VIEWS = new Set(["mail", "dumps", "databases"])

export function App() {
  const [activeView, setActiveView] = useState("general")
  const markPageSeen = useSidebarAttentionStore((s) => s.markSeen)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await bootstrapDevNest()
      if (!cancelled) connectToDaemon()
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeView === "mail" || activeView === "dumps" || activeView === "databases") {
      markPageSeen(activeView)
    }
  }, [activeView, markPageSeen])

  const renderView = () => {
    switch (activeView) {
      case "general": return <General />
      case "sites": return <Sites />
      case "installs": return <Installs />
      case "php": return <PHP />
      case "node": return <Node />
      case "services": return <Services />
      case "databases": return <Databases />
      case "queues": return <Queues />
      case "scheduler": return <Scheduler />
      case "mail": return <Mail />
      case "dumps": return <Dumps />
      case "logs": return <Logs />
      case "about": return <About />
      case "notifications": return <Notifications />
      default: return <General />
    }
  }

  const pageMeta = getPageMeta(activeView)
  const navItem = findNavItem(activeView)
  const PageIcon = navItem?.icon
  const isFullBleed = FULL_BLEED_VIEWS.has(activeView)

  return (
    <TooltipProvider delayDuration={300}>
      <OnboardingGate>
        <div className="app-chrome flex h-screen w-full overflow-hidden">
          <Sidebar activeView={activeView} setActiveView={setActiveView} />

          {/* Main panel — Herd-style content shell fills remaining width */}
          <div className="content-shell flex min-w-0 flex-1 flex-col overflow-hidden">
            <header className="content-toolbar flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {PageIcon && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300">
                    <PageIcon className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                    {getPageTitle(activeView)}
                  </h1>
                  {pageMeta && pageMeta.status !== "live" && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {pageMeta.label} · {pageMeta.description}
                    </p>
                  )}
                </div>
              </div>
              <NotificationCenter onViewAll={() => setActiveView("notifications")} />
            </header>

            <main
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                isFullBleed ? "p-0" : "px-5 py-4 lg:px-6 lg:py-5"
              )}
            >
              {!isFullBleed && <PageStatusBanner pageId={activeView} />}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {renderView()}
              </div>
            </main>
          </div>

          <Toaster richColors closeButton position="bottom-right" />
        </div>
      </OnboardingGate>
    </TooltipProvider>
  )
}

export default App
