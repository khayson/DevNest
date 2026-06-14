import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Code2,
  Terminal,
  Rows3,
} from "lucide-react"
import { useEffect, useState } from "react"
import type { CapturedDump } from "@/shared/store/captured"
import { formatBytes, formatFullTimestamp } from "@/shared/lib/mail"
import { isVarDumperHtml } from "@/shared/lib/dump-pretty"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { CopyButton } from "@/shared/ui/copy-button"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Switch } from "@/shared/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { isHtmlPayload } from "@/pages/dumps/dump-list-item"
import { cn } from "@/shared/lib/utils"

const PRETTY_STORAGE_KEY = "devnest-dumps-pretty"

interface DumpViewerProps {
  dump: CapturedDump | null
  activeTab: "rendered" | "raw"
  onTabChange: (tab: "rendered" | "raw") => void
  onBack?: () => void
  onDelete: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

export function DumpViewer({
  dump,
  activeTab,
  onTabChange,
  onBack,
  onDelete,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: DumpViewerProps) {
  const [pretty, setPretty] = useState(() => {
    try {
      return localStorage.getItem(PRETTY_STORAGE_KEY) !== "false"
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(PRETTY_STORAGE_KEY, String(pretty))
    } catch {
      /* ignore */
    }
  }, [pretty])

  if (!dump) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-center">
        <div className="rounded-2xl bg-muted/60 p-4">
          <Terminal className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Select a dump</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose an entry from the list to inspect the payload</p>
        </div>
      </div>
    )
  }

  const html = isHtmlPayload(dump.payload)
  const varDumper = isVarDumperHtml(dump.payload)
  const sourceHost = dump.source.split(":")[0] || dump.source

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-5">
        {onBack && (
          <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2 h-8 md:hidden" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            Dumps
          </Button>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-base font-semibold text-foreground">{dump.id}</h2>
              {html && (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  HTML
                </Badge>
              )}
              {varDumper && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  VarDumper
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              From <span className="font-mono">{sourceHost}</span>
              {" · "}
              {formatFullTimestamp(dump.timestamp)}
              {dump.size > 0 && (
                <>
                  {" · "}
                  {formatBytes(dump.size)}
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CopyButton value={dump.payload} label="Copy payload" variant="button" />
            <CopyButton value={dump.id} label="Copy ID" variant="button" />
            <CopyButton value={dump.source} label="Copy source" variant="button" />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onDelete} title="Remove from list">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <div className="ml-1 hidden items-center gap-0.5 sm:flex">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev} disabled={!hasPrev}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onNext} disabled={!hasNext}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as "rendered" | "raw")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2 sm:px-5">
          <TabsList className="h-8 bg-muted/80">
            <TabsTrigger value="rendered" className="gap-1.5 px-2.5 text-xs" disabled={!html}>
              <FileText className="h-3.5 w-3.5" />
              Rendered
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-1.5 px-2.5 text-xs">
              <Code2 className="h-3.5 w-3.5" />
              Raw
            </TabsTrigger>
          </TabsList>

          {html && activeTab === "rendered" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Rows3 className={cn("h-3.5 w-3.5", pretty ? "text-zinc-600 dark:text-zinc-300" : "opacity-40")} />
              <span className="font-medium">Pretty</span>
              <Switch checked={pretty} onCheckedChange={setPretty} aria-label="Toggle pretty dump formatting" />
            </label>
          )}
        </div>

        <div className="min-h-0 flex-1 bg-background">
          {activeTab === "rendered" && html ? (
            <ScrollArea className="h-full">
              <div
                className={cn(
                  "dump-output p-4 sm:p-5",
                  pretty ? "dump-output--pretty" : "dump-output--plain"
                )}
                dangerouslySetInnerHTML={{ __html: dump.payload }}
              />
            </ScrollArea>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-5">
                <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono text-[11px] leading-relaxed text-foreground/85">
                  {dump.payload || "(empty payload)"}
                </pre>
              </div>
            </ScrollArea>
          )}
        </div>
      </Tabs>
    </div>
  )
}
