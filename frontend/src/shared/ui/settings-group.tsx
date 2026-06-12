import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

interface SettingsGroupProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function SettingsGroup({
  title,
  description,
  children,
  className,
}: SettingsGroupProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm h-full",
        className
      )}
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

interface SettingsRowProps {
  label: string
  description?: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function SettingsRow({
  label,
  description,
  children,
  className,
  disabled,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5",
        disabled && "opacity-60",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0 self-end sm:self-center">{children}</div>
    </div>
  )
}
