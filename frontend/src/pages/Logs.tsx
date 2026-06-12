import { motion } from "framer-motion"
import {
  Terminal,
  Trash2,
  RefreshCw,
  Search,
  X,
  Pause,
  Play,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { clearLogInbox, syncLogInbox } from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"
import { useLogsStore, collectLogSources, formatLogSource, logLevelClass } from "@/shared/store/logs"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { cn } from "@/shared/lib/utils"
import { formatFullTimestamp } from "@/shared/lib/mail"

export function Logs() {
  const entries = useLogsStore((s) => s.entries)
  const clearEntries = useLogsStore((s) => s.clearEntries)
  const isConnected = useTelemetryStore((s) => s.isConnected)

  const [source, setSource] = useState("all")
  const [search, setSearch] = useState("")
  const [paused, setPaused] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sources = useMemo(() => collectLogSources(entries), [entries])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return entries.filter((e) => {
      if (source !== "all" && e.source !== source) return false
      if (!q) return true
      return (
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.level.toLowerCase().includes(q)
      )
    })
  }, [entries, source, search])

  const displayLines = useMemo(() => [...filtered].reverse(), [filtered])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!paused && entries.length > 0) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [entries.length, paused, displayLines.length, scrollToBottom])

  useEffect(() => {
    if (isConnected) syncLogInbox()
  }, [isConnected])

  const handleRefresh = () => {
    setRefreshing(true)
    if (syncLogInbox()) {
      notify.toast("Syncing logs...", "Fetching log buffer from daemon", "info")
    }
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleClear = () => {
    clearEntries()
    if (clearLogInbox()) {
      notify.success("Logs cleared", "Buffered log entries removed.", "system")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="h-full min-h-0 w-full"
    >
      <PageLayout noScroll className="p-3 sm:p-4">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2.5 sm:px-4">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Logs</h1>
              <p className="text-xs text-muted-foreground">
                Live tail from DevNest, Caddy, and Laravel <code className="text-[10px]">storage/logs/laravel.log</code>
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground"
              >
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All sources" : formatLogSource(s)}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPaused((p) => !p)}
                title={paused ? "Resume auto-scroll" : "Pause auto-scroll"}
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={!isConnected}
                title="Sync logs"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>

              {entries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={handleClear}
                  title="Clear log buffer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter log lines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
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

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950 font-mono text-[11px] leading-relaxed">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-900 px-4 py-2 text-zinc-400">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                <span>
                  {source === "all" ? "all_sources.log" : `${source.replace(":", "_")}.log`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="tabular-nums">{displayLines.length} lines</span>
                <span className={cn("flex items-center gap-1", isConnected ? "text-emerald-500" : "text-red-400")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-emerald-500" : "bg-red-400")} />
                  {isConnected ? (paused ? "Paused" : "Live") : "Offline"}
                </span>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-4 custom-scrollbar select-text">
              {displayLines.length === 0 ? (
                <div className="text-zinc-500 italic">
                  {isConnected
                    ? "No log lines yet. Daemon, Caddy, and Laravel logs appear here as they are written."
                    : "Connect to the daemon to stream logs."}
                </div>
              ) : (
                displayLines.map((entry) => (
                  <div key={entry.id} className="group flex gap-2 py-0.5 hover:bg-zinc-900/40">
                    <span className="shrink-0 text-zinc-600 tabular-nums">
                      {formatFullTimestamp(entry.timestamp).split(", ").pop()}
                    </span>
                    <span className="shrink-0 w-16 truncate text-zinc-500" title={formatLogSource(entry.source)}>
                      [{entry.source.split(":")[0]}]
                    </span>
                    <span className={cn("shrink-0 w-14 font-semibold", logLevelClass(entry.level))}>
                      {entry.level}
                    </span>
                    <span className={cn("min-w-0 flex-1 whitespace-pre-wrap break-all", logLevelClass(entry.level))}>
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PageLayout>
    </motion.div>
  )
}
