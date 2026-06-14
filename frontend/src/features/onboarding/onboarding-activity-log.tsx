import { cn } from "@/shared/lib/utils"

export type ActivityLevel = "info" | "success" | "warning" | "error"

export interface ActivityEntry {
  id: string
  level: ActivityLevel
  message: string
  time: string
}

const LEVEL_STYLES: Record<ActivityLevel, string> = {
  info: "text-zinc-500",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
}

export function OnboardingActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Activity</p>
      <div
        className="max-h-28 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/50"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <ul className="space-y-1 font-mono text-[11px] leading-relaxed">
          {entries.map((entry) => (
            <li key={entry.id} className={cn("flex gap-2", LEVEL_STYLES[entry.level])}>
              <span className="shrink-0 tabular-nums opacity-60">{entry.time}</span>
              <span className="min-w-0 break-words">{entry.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
