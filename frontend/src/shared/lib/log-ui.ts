import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Info,
  Server,
  Waypoints,
  Layers,
  type LucideIcon,
} from "lucide-react"
import { formatLogSource } from "@/shared/store/logs"

export type LogLevelFilter = "all" | "ERROR" | "WARNING" | "INFO" | "DEBUG"

export interface LogLevelMeta {
  label: string
  icon: LucideIcon
  text: string
  textMuted: string
  bg: string
  border: string
  dot: string
  glow?: string
}

export interface LogSourceMeta {
  label: string
  abbrev: string
  icon: LucideIcon
  chip: string
  chipActive: string
  accent: string
}

export function logLevelMeta(level: string): LogLevelMeta {
  switch (level.toUpperCase()) {
    case "ERROR":
      return {
        label: "Error",
        icon: AlertCircle,
        text: "text-red-400",
        textMuted: "text-red-400/80",
        bg: "bg-red-500/10",
        border: "border-red-500/25",
        dot: "bg-red-500",
        glow: "shadow-[0_0_10px_rgba(239,68,68,0.35)]",
      }
    case "WARNING":
      return {
        label: "Warning",
        icon: AlertTriangle,
        text: "text-amber-400",
        textMuted: "text-amber-400/80",
        bg: "bg-amber-500/10",
        border: "border-amber-500/25",
        dot: "bg-amber-500",
        glow: "shadow-[0_0_10px_rgba(245,158,11,0.3)]",
      }
    case "DEBUG":
      return {
        label: "Debug",
        icon: Bug,
        text: "text-zinc-500",
        textMuted: "text-zinc-500/80",
        bg: "bg-zinc-500/10",
        border: "border-zinc-600/30",
        dot: "bg-zinc-500",
      }
    default:
      return {
        label: "Info",
        icon: Info,
        text: "text-teal-400",
        textMuted: "text-teal-400/80",
        bg: "bg-teal-500/10",
        border: "border-teal-500/25",
        dot: "bg-teal-500",
        glow: "shadow-[0_0_10px_rgba(45,212,191,0.25)]",
      }
  }
}

export function logSourceMeta(source: string): LogSourceMeta {
  if (source === "devnest") {
    return {
      label: "DevNest",
      abbrev: "DN",
      icon: Layers,
      chip: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
      chipActive: "bg-emerald-500/20 border-emerald-500/40 ring-1 ring-emerald-500/30",
      accent: "text-emerald-500",
    }
  }
  if (source === "caddy") {
    return {
      label: "Caddy",
      abbrev: "CD",
      icon: Waypoints,
      chip: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
      chipActive: "bg-violet-500/20 border-violet-500/40 ring-1 ring-violet-500/30",
      accent: "text-violet-500",
    }
  }
  if (source.startsWith("laravel") || source === "laravel") {
    return {
      label: formatLogSource(source),
      abbrev: "LV",
      icon: Server,
      chip: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
      chipActive: "bg-rose-500/20 border-rose-500/40 ring-1 ring-rose-500/30",
      accent: "text-rose-500",
    }
  }
  return {
    label: formatLogSource(source),
    abbrev: source.slice(0, 2).toUpperCase(),
    icon: Server,
    chip: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
    chipActive: "bg-zinc-500/20 border-zinc-500/40",
    accent: "text-zinc-400",
  }
}

export const LEVEL_FILTERS: { id: LogLevelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ERROR", label: "Errors" },
  { id: "WARNING", label: "Warnings" },
  { id: "INFO", label: "Info" },
  { id: "DEBUG", label: "Debug" },
]

export function countLogLevels(entries: { level: string }[]) {
  const counts = { ERROR: 0, WARNING: 0, INFO: 0, DEBUG: 0 }
  for (const e of entries) {
    const key = e.level.toUpperCase() as keyof typeof counts
    if (key in counts) counts[key]++
    else counts.INFO++
  }
  return counts
}

export function countBySource(entries: { source: string }[]) {
  const map = new Map<string, number>()
  for (const e of entries) {
    map.set(e.source, (map.get(e.source) ?? 0) + 1)
  }
  return map
}

export function sourceErrorCount(entries: { source: string; level: string }[], source: string) {
  return entries.filter((e) => e.source === source && e.level.toUpperCase() === "ERROR").length
}
