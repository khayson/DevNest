import { useEffect, useMemo, useRef } from "react"
import { Trash2, Terminal } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useWorkerOutputStore, type WorkerOutputLine } from "@/shared/store/worker-output"
import { clearWorkerOutput } from "@/shared/api/ws"

interface WorkerActivityPanelProps {
  kind: "queue" | "scheduler" | "node"
  title: string
  selectedDomain: string | null
  domains: { domain: string; label: string; running: boolean }[]
  onSelectDomain: (domain: string) => void
  emptyHint?: string
}

function formatTime(unix: number): string {
  if (!unix) return ""
  return new Date(unix * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function lineClass(line: WorkerOutputLine): string {
  if (line.stream === "stderr") return "text-red-400/90"
  if (line.text.startsWith("[DevNest]")) return "text-blue-400/90"
  return "text-zinc-300"
}

export function WorkerActivityPanel({
  kind,
  title,
  selectedDomain,
  domains,
  onSelectDomain,
  emptyHint,
}: WorkerActivityPanelProps) {
  const allLines = useWorkerOutputStore((s) => s.lines)
  const lines = useMemo(
    () =>
      allLines.filter((l) => {
        if (l.kind !== kind) return false
        if (selectedDomain && l.domain !== selectedDomain) return false
        return true
      }),
    [allLines, kind, selectedDomain]
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [lines.length, selectedDomain])

  const clearOutput = () => {
    clearWorkerOutput(kind, selectedDomain ?? undefined)
  }

  const activeDomain = selectedDomain ?? domains.find((d) => d.running)?.domain ?? domains[0]?.domain

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden min-h-[220px] max-h-[360px]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {domains.map((d) => (
            <button
              key={d.domain}
              type="button"
              onClick={() => onSelectDomain(d.domain)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                activeDomain === d.domain
                  ? "bg-zinc-700 border-zinc-600 text-white"
                  : "bg-transparent border-zinc-700 text-zinc-400 hover:text-zinc-200",
                d.running && activeDomain !== d.domain && "border-emerald-800/60 text-emerald-400/80"
              )}
            >
              {d.label}
              {d.running ? " •" : ""}
            </button>
          ))}
          <button
            type="button"
            onClick={clearOutput}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Clear output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed custom-scrollbar">
        {lines.length === 0 ? (
          <p className="text-zinc-500 italic">
            {emptyHint ??
              (activeDomain
                ? `No output yet for ${activeDomain}. Start the worker to see live activity here.`
                : "Select a project to view worker output.")}
          </p>
        ) : (
          lines.map((line, i) => (
            <div key={`${line.time_unix}-${i}`} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-zinc-600 select-none">{formatTime(line.time_unix)}</span>
              <span className={cn("break-all whitespace-pre-wrap", lineClass(line))}>{line.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
