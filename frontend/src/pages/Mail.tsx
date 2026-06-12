import { motion, AnimatePresence } from "framer-motion"
import {
  Inbox,
  RefreshCw,
  Search,
  Trash2,
  MoreHorizontal,
  Download,
  ArrowUpDown,
  Filter,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { sendCommand } from "@/shared/api/ws"
import { startServiceWithFeedback } from "@/shared/lib/service-actions"
import {
  copyToClipboard,
  formatBytes,
  extractUniqueAddresses,
  buildEmlFile,
  downloadFile,
} from "@/shared/lib/mail"
import { notify } from "@/shared/store/notifications"
import { useCapturedStore, type CapturedEmail } from "@/shared/store/captured"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { SmtpStatus } from "@/shared/ui/smtp-status"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Separator } from "@/shared/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { MailListItem } from "@/pages/mail/mail-list-item"
import { MailEmptyState, ENV_SNIPPET } from "@/pages/mail/mail-empty-state"
import { MailReader, type ContentTab } from "@/pages/mail/mail-reader"

type SortOrder = "newest" | "oldest" | "largest"

export function Mail() {
  const emails = useCapturedStore((s) => s.emails)
  const clearEmails = useCapturedStore((s) => s.clearEmails)
  const removeEmail = useCapturedStore((s) => s.removeEmail)
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const mailRunning = useTelemetryStore((s) => s.services["embedded-mail-server"]?.state === "running")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ContentTab>("preview")
  const [search, setSearch] = useState("")
  const [senderFilter, setSenderFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [newestId, setNewestId] = useState<string | null>(null)
  const [copiedEnv, setCopiedEnv] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isStartingSmtp, setIsStartingSmtp] = useState(false)
  const [mobilePane, setMobilePane] = useState<"list" | "read">("list")
  const prevFirstIdRef = useRef<string | null>(null)

  const senders = useMemo(() => extractUniqueAddresses(emails, "sender"), [emails])
  const totalBytes = useMemo(() => emails.reduce((sum, e) => sum + (e.size ?? 0), 0), [emails])

  const filteredEmails = useMemo(() => {
    let list = emails.filter((e) => {
      const q = search.toLowerCase()
      const matchesSearch =
        e.subject.toLowerCase().includes(q) ||
        e.sender.toLowerCase().includes(q) ||
        e.recipient.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q)
      const matchesSender = senderFilter === "all" || e.sender === senderFilter
      return matchesSearch && matchesSender
    })

    list = [...list].sort((a, b) => {
      if (sortOrder === "largest") return (b.size ?? 0) - (a.size ?? 0)
      const ta = new Date(a.timestamp).getTime()
      const tb = new Date(b.timestamp).getTime()
      return sortOrder === "oldest" ? ta - tb : tb - ta
    })

    return list
  }, [emails, search, senderFilter, sortOrder])

  const selectedEmail = emails.find((e) => e.id === selectedId) ?? null
  const selectedIndex = filteredEmails.findIndex((e) => e.id === selectedId)

  useEffect(() => {
    if (emails.length === 0) {
      setSelectedId(null)
      prevFirstIdRef.current = null
      return
    }
    const latest = emails[0]
    if (!selectedId || !emails.some((e) => e.id === selectedId)) {
      setSelectedId(latest.id)
    }
    if (prevFirstIdRef.current && latest.id !== prevFirstIdRef.current) {
      setNewestId(latest.id)
      const timer = setTimeout(() => setNewestId(null), 4000)
      prevFirstIdRef.current = latest.id
      return () => clearTimeout(timer)
    }
    prevFirstIdRef.current = latest.id
  }, [emails, selectedId])

  useEffect(() => {
    if (mailRunning) setIsStartingSmtp(false)
  }, [mailRunning])

  useEffect(() => {
    if (!isStartingSmtp) return
    const t = setTimeout(() => setIsStartingSmtp(false), 7000)
    return () => clearTimeout(t)
  }, [isStartingSmtp])

  const navigateEmail = useCallback(
    (direction: 1 | -1) => {
      if (filteredEmails.length === 0) return
      const idx = filteredEmails.findIndex((e) => e.id === selectedId)
      const next = idx === -1 ? 0 : Math.max(0, Math.min(filteredEmails.length - 1, idx + direction))
      setSelectedId(filteredEmails[next].id)
      setMobilePane("read")
    },
    [filteredEmails, selectedId]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        navigateEmail(1)
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        navigateEmail(-1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigateEmail])

  const handleStartSmtp = () => {
    setIsStartingSmtp(true)
    startServiceWithFeedback("embedded-mail-server")
  }

  const handleRefresh = () => {
    setRefreshing(true)
    if (sendCommand("get_mail_inbox")) {
      notify.toast("Syncing inbox…", "Fetching messages from daemon", "info")
    }
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleClearAll = () => {
    clearEmails()
    setSelectedId(null)
    setMobilePane("list")
    if (sendCommand("clear_mail_inbox")) {
      notify.success("Inbox cleared", "All captured messages removed.", "mail")
    }
  }

  const handleExportEml = (email: CapturedEmail) => {
    const safeName = (email.subject || email.id).replace(/[^\w.-]+/g, "_").slice(0, 40)
    downloadFile(`${safeName}.eml`, buildEmlFile(email))
  }

  const handleDeleteSelected = () => {
    if (!selectedId) return
    const idx = emails.findIndex((e) => e.id === selectedId)
    removeEmail(selectedId)
    const remaining = emails.filter((e) => e.id !== selectedId)
    setSelectedId(remaining[Math.min(idx, remaining.length - 1)]?.id ?? null)
  }

  const handleCopyEnv = async () => {
    await copyToClipboard(ENV_SNIPPET)
    setCopiedEnv(true)
    setTimeout(() => setCopiedEnv(false), 2000)
  }

  const sortLabels: Record<SortOrder, string> = {
    newest: "Newest first",
    oldest: "Oldest first",
    largest: "Largest first",
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
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2.5 sm:px-4">
            <SmtpStatus
              isConnected={isConnected}
              mailRunning={mailRunning}
              isStarting={isStartingSmtp}
              onStartSmtp={handleStartSmtp}
            />

            {emails.length > 0 && (
              <>
                <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
                <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                  <Inbox className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums text-foreground">{emails.length}</span>
                  <span>messages</span>
                  <span className="text-border">·</span>
                  <span className="tabular-nums">{senders.length} senders</span>
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
                title="Sync inbox"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>

              {emails.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      disabled={!selectedId}
                      onClick={() => selectedEmail && handleExportEml(selectedEmail)}
                    >
                      <Download className="h-4 w-4" />
                      Export selected .eml
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!selectedId} onClick={handleDeleteSelected}>
                      <Trash2 className="h-4 w-4" />
                      Delete selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleClearAll}
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear entire inbox
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {emails.length === 0 ? (
            <MailEmptyState
              onCopyEnv={handleCopyEnv}
              copiedEnv={copiedEnv}
              isConnected={isConnected}
              mailRunning={mailRunning}
              isStarting={isStartingSmtp}
              onStartSmtp={handleStartSmtp}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* Inbox list */}
              <div
                className={cn(
                  "flex min-h-0 flex-col border-border md:w-80 md:shrink-0 md:border-r lg:w-[340px]",
                  mobilePane === "read" ? "hidden md:flex" : "flex flex-1 md:flex-none"
                )}
              >
                <div className="shrink-0 space-y-2.5 border-b border-border p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search mail…"
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

                  <div className="flex flex-wrap items-center gap-1.5">
                    {senders.length > 1 && (
                      <div className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
                        <Filter className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <select
                          value={senderFilter}
                          onChange={(e) => setSenderFilter(e.target.value)}
                          className="min-w-0 flex-1 truncate bg-transparent text-[11px] font-medium text-foreground focus:outline-none"
                        >
                          <option value="all">All senders</option>
                          {senders.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {emails.length > 1 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]">
                            <ArrowUpDown className="h-3 w-3" />
                            {sortLabels[sortOrder]}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          {(Object.keys(sortLabels) as SortOrder[]).map((key) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => setSortOrder(key)}
                              className={cn(sortOrder === key && "bg-accent")}
                            >
                              {sortLabels[key]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <span className="ml-auto hidden text-[10px] text-muted-foreground lg:inline">
                      j/k navigate
                    </span>
                  </div>

                  {filteredEmails.length !== emails.length && (
                    <p className="text-[11px] text-muted-foreground">
                      Showing {filteredEmails.length} of {emails.length}
                    </p>
                  )}
                </div>

                <ScrollArea className="min-h-0 flex-1 bg-muted/15">
                  {filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                      <Search className="h-6 w-6 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No messages match your filters</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSearch("")
                          setSenderFilter("all")
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      <AnimatePresence initial={false}>
                        {filteredEmails.map((email) => (
                          <motion.div
                            key={email.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <MailListItem
                              email={email}
                              isSelected={email.id === selectedId}
                              isNew={email.id === newestId}
                              onSelect={() => {
                                setSelectedId(email.id)
                                setActiveTab("preview")
                                setMobilePane("read")
                              }}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Reader */}
              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col",
                  mobilePane === "list" ? "hidden md:flex" : "flex"
                )}
              >
                <MailReader
                  email={selectedEmail}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  onBack={() => setMobilePane("list")}
                  onDelete={handleDeleteSelected}
                  onExport={handleExportEml}
                  onPrev={() => navigateEmail(-1)}
                  onNext={() => navigateEmail(1)}
                  hasPrev={selectedIndex > 0}
                  hasNext={selectedIndex >= 0 && selectedIndex < filteredEmails.length - 1}
                />
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </motion.div>
  )
}
