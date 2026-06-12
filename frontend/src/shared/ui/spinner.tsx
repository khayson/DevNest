import { Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface SpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
  label?: string
}

const sizes = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" }

export function Spinner({ className, size = "md", label }: SpinnerProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizes[size])} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  )
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary/80" />
      <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
    </div>
  )
}

export function SiteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border bg-muted/20 p-4 space-y-3"
        >
          <div className="flex justify-between gap-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
          <div className="h-3 w-48 rounded bg-muted/70" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 rounded bg-muted/60" />
            <div className="h-3 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  )
}
