import { create } from "zustand"

export interface LogEntry {
  id: string
  source: string
  level: string
  message: string
  timestamp: string
  file?: string
  line?: number
}

interface LogsState {
  entries: LogEntry[]
  addEntry: (entry: Partial<LogEntry>) => void
  setEntries: (entries: LogEntry[]) => void
  clearEntries: () => void
}

function normalizeEntry(raw: Partial<LogEntry>): LogEntry {
  return {
    id: raw.id ?? crypto.randomUUID(),
    source: raw.source ?? "unknown",
    level: raw.level ?? "INFO",
    message: raw.message ?? "",
    timestamp: raw.timestamp ?? new Date().toISOString(),
    file: raw.file,
    line: raw.line,
  }
}

export const useLogsStore = create<LogsState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((state) => {
      const normalized = normalizeEntry(entry)
      if (state.entries.some((e) => e.id === normalized.id)) return state
      return { entries: [normalized, ...state.entries] }
    }),
  setEntries: (entries) =>
    set({
      entries: entries.map((e) => normalizeEntry(e)),
    }),
  clearEntries: () => set({ entries: [] }),
}))

export function formatLogSource(source: string): string {
  if (source === "devnest") return "DevNest"
  if (source === "caddy") return "Caddy"
  if (source.startsWith("laravel:")) {
    return `Laravel (${source.slice("laravel:".length)})`
  }
  if (source === "laravel") return "Laravel"
  return source
}

export function logLevelClass(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "text-red-400"
    case "WARNING":
      return "text-amber-400"
    case "DEBUG":
      return "text-zinc-500"
    default:
      return "text-zinc-300"
  }
}

export function collectLogSources(entries: LogEntry[]): string[] {
  const sources = new Set<string>()
  for (const e of entries) sources.add(e.source)
  return ["all", ...Array.from(sources).sort()]
}
