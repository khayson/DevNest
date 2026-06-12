import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import { ScrollArea, ScrollBar } from "@/shared/ui/scroll-area"

interface ResponsiveTableProps {
  children: ReactNode
  /** Minimum table width before horizontal scroll kicks in */
  minWidth?: number
  className?: string
  hint?: string
  /** Fill parent height and scroll vertically + horizontally */
  fill?: boolean
}

/** Wraps wide data tables: horizontal scroll on narrow viewports + scroll hint. */
export function ResponsiveTable({
  children,
  minWidth = 720,
  className,
  hint = "Swipe horizontally to see all columns",
  fill = false,
}: ResponsiveTableProps) {
  const table = (
    <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
      {children}
    </table>
  )

  const hintEl = (
    <p className="shrink-0 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/80">
      {hint}
    </p>
  )

  if (fill) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50",
          className
        )}
      >
        {hintEl}
        <ScrollArea className="min-h-0 flex-1">
          <div className="w-max min-w-full">{table}</div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50",
        className
      )}
    >
      {hintEl}
      <div className="custom-scrollbar overflow-x-auto">
        {table}
      </div>
    </div>
  )
}

export function ResponsiveTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
      {children}
    </thead>
  )
}

export function ResponsiveTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-500 dark:text-zinc-400">{children}</tbody>
}

interface MobileDataCardProps {
  title: string
  subtitle?: string
  badge?: ReactNode
  rows: { label: string; value: ReactNode; breakAll?: boolean }[]
  actions?: ReactNode
  selected?: boolean
  onSelect?: () => void
}

/** Card layout for table rows on small screens (optional companion to ResponsiveTable). */
export function MobileDataCard({
  title,
  subtitle,
  badge,
  rows,
  actions,
  selected,
  onSelect,
}: MobileDataCardProps) {
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(e) => onSelect && e.key === "Enter" && onSelect()}
      className={cn(
        "rounded-lg border p-4 space-y-3 transition-colors",
        selected
          ? "border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-950/20"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50",
        onSelect && "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{title}</div>
          {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
        </div>
        {badge}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-zinc-400 font-semibold uppercase tracking-wide text-[10px]">{row.label}</dt>
            <dd className={cn("text-zinc-700 dark:text-zinc-300 mt-0.5", row.breakAll ? "break-all whitespace-normal" : "truncate")}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {actions && <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">{actions}</div>}
    </div>
  )
}

export function MobileCardList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("xl:hidden space-y-3 min-w-0", className)}>{children}</div>
}

export function DesktopTableOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("hidden xl:block min-w-0", className)}>{children}</div>
}
