import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Terminal, Trash2, MoreHorizontal, Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { sendCommand, syncDumpInbox, toggleDumpWatch } from "@/shared/api/ws"
import { formatBytes } from "@/shared/lib/mail"
import { startServiceWithFeedback } from "@/shared/lib/service-actions"
import { notify } from "@/shared/store/notifications"
import { useCapturedStore } from "@/shared/store/captured"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Separator } from "@/shared/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { DumpListItem } from "@/pages/dumps/dump-list-item"
import { DumpsEmptyState } from "@/pages/dumps/dumps-empty-state"
import { DumpViewer } from "@/pages/dumps/dump-viewer"

type ViewerTab = "rendered" | "raw"

export function Dumps() {
  const dumps = useCapturedStore((s) => s.dumps)
  const isDumpWatched = useCapturedStore((s) => s.isDumpWatched)
  const clearDumps = useCapturedStore((s) => s.clearDumps)
  const removeDump = useCapturedStore((s) => s.removeDump)
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const dumpRunning = useTelemetryStore((s) => s.services["embedded-dump-server"]?.state === "running")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewerTab>("rendered")
  const [search, setSearch] = useState("")
  const [newestId, setNewestId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [mobilePane, setMobilePane] = useState<"list" | "view">("list")
  const prevFirstIdRef = useRef<string | null>(null)

  const totalBytes = useMemo(() => dumps.reduce((sum, d) => sum + (d.size ?? 0), 0), [dumps])

  const filteredDumps = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return dumps
    return dumps.filter(
      (d) =>
        d.id.toLowerCase().includes(q) ||
        d.source.toLowerCase().includes(q) ||
        d.payload.toLowerCase().includes(q)
    )
  }, [dumps, search])

  const selectedDump = dumps.find((d) => d.id === selectedId) ?? null
  const selectedIndex = filteredDumps.findIndex((d) => d.id === selectedId)

  useEffect(() => {
    if (dumps.length === 0) {
      setSelectedId(null)
      prevFirstIdRef.current = null
      return
    }
    const latest = dumps[0]
    if (!selectedId || !dumps.some((d) => d.id === selectedId)) {
      setSelectedId(latest.id)
    }
    if (prevFirstIdRef.current && latest.id !== prevFirstIdRef.current) {
      setNewestId(latest.id)
      const timer = setTimeout(() => setNewestId(null), 4000)
      prevFirstIdRef.current = latest.id
      return () => clearTimeout(timer)
    }
    prevFirstIdRef.current = latest.id
  }, [dumps, selectedId])

  useEffect(() => {
    if (isConnected) {
      syncDumpInbox()
    }
  }, [isConnected])

  useEffect(() => {
    if (dumpRunning) setIsStarting(false)
  }, [dumpRunning])

  useEffect(() => {
    if (selectedDump && !selectedDump.payload.trim().startsWith("<")) {
      setActiveTab("raw")
    }
  }, [selectedDump?.id, selectedDump?.payload])

  const navigateDump = useCallback(
    (direction: 1 | -1) => {
      if (filteredDumps.length === 0) return
      const idx = filteredDumps.findIndex((d) => d.id === selectedId)
      const next = idx === -1 ? 0 : Math.max(0, Math.min(filteredDumps.length - 1, idx + direction))
      setSelectedId(filteredDumps[next].id)
      setMobilePane("view")
    },
    [filteredDumps, selectedId]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        navigateDump(1)
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        navigateDump(-1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigateDump])

  const handleStartDumpServer = () => {
    setIsStarting(true)
    startServiceWithFeedback("embedded-dump-server")
  }

  const handleRefresh = () => {
    setRefreshing(true)
    if (syncDumpInbox()) {
      notify.toast("Syncing dumps…", "Fetching captured dumps from daemon", "info")
    }
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleClearAll = () => {
    clearDumps()
    setSelectedId(null)
    setMobilePane("list")
    if (sendCommand("clear_dump_inbox")) {
      notify.success("Dumps cleared", "All captured dumps removed.", "dump")
    }
  }

  const handleDeleteSelected = () => {
    if (!selectedId) return
    const idx = dumps.findIndex((d) => d.id === selectedId)
    removeDump(selectedId)
    const remaining = dumps.filter((d) => d.id !== selectedId)
    setSelectedId(remaining[Math.min(idx, remaining.length - 1)]?.id ?? null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="h-full min-h-0 w-full"
    >
      <PageLayout noScroll className="p-3 sm:p-4">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2.5 sm:px-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              <Terminal className="h-3 w-3" />
              Dump server
              <span className={cn("h-1.5 w-1.5 rounded-full", dumpRunning ? "bg-emerald-500" : "bg-muted-foreground/40")} />
            </div>

            {dumps.length > 0 && (
              <>
                <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
                <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                  <span className="font-medium tabular-nums text-foreground">{dumps.length}</span>
                  <span>dumps</span>
                  <span className="text-border">·</span>
                  <span className="tabular-nums">{formatBytes(totalBytes)}</span>
                </div>
              </>
            )}

            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={!isConnected}
                title="Sync dumps"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>

              {dumps.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleClearAll}
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear all dumps
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {dumps.length === 0 ? (
            <DumpsEmptyState
              isConnected={isConnected}
              dumpRunning={dumpRunning}
              isStarting={isStarting}
              onStartDumpServer={handleStartDumpServer}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div
                className={cn(
                  "flex min-h-0 flex-col border-border md:w-72 md:shrink-0 md:border-r lg:w-80",
                  mobilePane === "view" ? "hidden md:flex" : "flex flex-1 md:flex-none"
                )}
              >
                <div className="shrink-0 border-b border-border p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search dumps…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 pl-8 text-xs"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1 bg-muted/15">
                  {filteredDumps.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">No dumps match your search</div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      <AnimatePresence initial={false}>
                        {filteredDumps.map((dump) => (
                          <motion.div
                            key={dump.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <DumpListItem
                              dump={dump}
                              isSelected={dump.id === selectedId}
                              isNew={dump.id === newestId}
                              watched={isDumpWatched(dump.id)}
                              onToggleWatch={() => toggleDumpWatch(dump.id, !isDumpWatched(dump.id))}
                              onSelect={() => {
                                setSelectedId(dump.id)
                                setActiveTab("rendered")
                                setMobilePane("view")
                              }}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col",
                  mobilePane === "list" ? "hidden md:flex" : "flex"
                )}
              >
                <DumpViewer
                  dump={selectedDump}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onBack={() => setMobilePane("list")}
                  onDelete={handleDeleteSelected}
                  onPrev={() => navigateDump(-1)}
                  onNext={() => navigateDump(1)}
                  hasPrev={selectedIndex > 0}
                  hasNext={selectedIndex >= 0 && selectedIndex < filteredDumps.length - 1}
                />
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </motion.div>
  )
}
