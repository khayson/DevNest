import { motion } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { clearLogInbox, syncLogInbox } from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"
import { useLogsStore, collectLogSources } from "@/shared/store/logs"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { logMessageIsPrettyable } from "@/shared/lib/log-pretty"
import type { LogLevelFilter } from "@/shared/lib/log-ui"
import { PageLayout } from "@/shared/ui/page-layout"
import { cn } from "@/shared/lib/utils"
import { LogsToolbar } from "@/pages/logs/logs-toolbar"
import { LogsFilterBar } from "@/pages/logs/logs-filter-bar"
import { LogsSourceNav } from "@/pages/logs/logs-source-nav"
import { LogsStream } from "@/pages/logs/logs-stream"
import { LogsInspector } from "@/pages/logs/logs-inspector"
import { LogsEmptyState } from "@/pages/logs/logs-empty-state"

type ViewerTab = "formatted" | "raw"
type MobilePane = "stream" | "inspector"

export function Logs() {
  const entries = useLogsStore((s) => s.entries)
  const clearEntries = useLogsStore((s) => s.clearEntries)
  const isConnected = useTelemetryStore((s) => s.isConnected)

  const [source, setSource] = useState("all")
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>("all")
  const [search, setSearch] = useState("")
  const [paused, setPaused] = useState(false)
  const [followTail, setFollowTail] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ViewerTab>("formatted")
  const [newestId, setNewestId] = useState<string | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>("stream")
  const prevFirstIdRef = useRef<string | null>(null)

  const sources = useMemo(() => collectLogSources(entries), [entries])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return entries.filter((e) => {
      if (source !== "all" && e.source !== source) return false
      if (levelFilter !== "all" && e.level.toUpperCase() !== levelFilter) return false
      if (!q) return true
      return (
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.level.toLowerCase().includes(q)
      )
    })
  }, [entries, source, levelFilter, search])

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null
  const selectedIndex = filtered.findIndex((e) => e.id === selectedId)

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedId(null)
      prevFirstIdRef.current = null
      return
    }
    const latest = entries[0]
    if (!paused && followTail && !selectedId) {
      setSelectedId(latest.id)
    }
    if (prevFirstIdRef.current && latest.id !== prevFirstIdRef.current) {
      setNewestId(latest.id)
      const timer = setTimeout(() => setNewestId(null), 3500)
      prevFirstIdRef.current = latest.id
      return () => clearTimeout(timer)
    }
    prevFirstIdRef.current = latest.id
  }, [entries, selectedId, paused, followTail])

  useEffect(() => {
    if (selectedEntry && !logMessageIsPrettyable(selectedEntry.message)) {
      setActiveTab("raw")
    }
  }, [selectedEntry?.id, selectedEntry?.message])

  useEffect(() => {
    if (isConnected) syncLogInbox()
  }, [isConnected])

  const selectEntry = useCallback((id: string, prettyable: boolean, openInspector = false) => {
    setSelectedId(id)
    setActiveTab(prettyable ? "formatted" : "raw")
    setFollowTail(false)
    if (openInspector) setMobilePane("inspector")
  }, [])

  const closeInspector = useCallback(() => setMobilePane("stream"), [])

  const navigateEntry = useCallback(
    (direction: 1 | -1) => {
      if (filtered.length === 0) return
      const idx = filtered.findIndex((e) => e.id === selectedId)
      const next = idx === -1 ? 0 : Math.max(0, Math.min(filtered.length - 1, idx + direction))
      const entry = filtered[next]
      selectEntry(entry.id, logMessageIsPrettyable(entry.message), true)
    },
    [filtered, selectedId, selectEntry]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        navigateEntry(1)
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        navigateEntry(-1)
      } else if (e.key === "Escape") {
        setMobilePane("stream")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigateEntry])

  const handleRefresh = () => {
    setRefreshing(true)
    if (syncLogInbox()) notify.toast("Syncing logs...", "Fetching log buffer from daemon", "info")
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleClear = () => {
    clearEntries()
    setSelectedId(null)
    setMobilePane("stream")
    if (clearLogInbox()) notify.success("Logs cleared", "Buffered log entries removed.", "system")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="h-full min-h-0 w-full"
    >
      <PageLayout noScroll className="p-2 sm:p-3">
        <div className="logs-console flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl">
          <LogsToolbar
            search={search}
            onSearchChange={setSearch}
            isConnected={isConnected}
            paused={paused}
            refreshing={refreshing}
            filteredCount={filtered.length}
            totalCount={entries.length}
            onTogglePause={() => setPaused((p) => !p)}
            onRefresh={handleRefresh}
            onClear={handleClear}
            canClear={entries.length > 0}
          />

          {entries.length === 0 ? (
            <LogsEmptyState isConnected={isConnected} onRefresh={handleRefresh} refreshing={refreshing} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <LogsFilterBar
                entries={entries}
                sources={sources}
                activeSource={source}
                levelFilter={levelFilter}
                onSourceChange={setSource}
                onLevelFilter={setLevelFilter}
              />

              <LogsSourceNav
                entries={entries}
                sources={sources}
                activeSource={source}
                levelFilter={levelFilter}
                onSourceChange={setSource}
                onLevelFilter={setLevelFilter}
              />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
                <div
                  className={cn(
                    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                    mobilePane === "inspector" ? "hidden md:flex" : "flex"
                  )}
                >
                  <LogsStream
                    entries={filtered}
                    selectedId={selectedId}
                    newestId={newestId}
                    paused={paused}
                    followTail={followTail}
                    onSelect={(entry) =>
                      selectEntry(entry.id, logMessageIsPrettyable(entry.message), true)
                    }
                    onToggleFollow={() => setFollowTail((f) => !f)}
                  />
                </div>

                <LogsInspector
                  entry={selectedEntry}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  mobileOpen={mobilePane === "inspector"}
                  onClose={closeInspector}
                  onPrev={() => navigateEntry(-1)}
                  onNext={() => navigateEntry(1)}
                  hasPrev={selectedIndex > 0}
                  hasNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1}
                />
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </motion.div>
  )
}
