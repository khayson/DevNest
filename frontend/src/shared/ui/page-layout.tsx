import type { ReactNode } from "react"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { cn } from "@/shared/lib/utils"

interface PageLayoutProps {
  children: ReactNode
  className?: string
  /** Disable outer scroll — use when the page manages its own scroll regions (e.g. Mail split view). */
  noScroll?: boolean
}

export function PageLayout({ children, className, noScroll = false }: PageLayoutProps) {
  if (noScroll) {
    return (
      <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col", className)}>
      <ScrollArea className="flex-1 min-h-0 min-w-0">
        <div className="w-full min-w-0 max-w-full space-y-5 pb-8 pr-1">{children}</div>
      </ScrollArea>
    </div>
  )
}

interface PageGridProps {
  children: ReactNode
  className?: string
}

/** Responsive multi-column grid for settings-style pages — fills available width. */
export function PageGrid({ children, className }: PageGridProps) {
  return (
    <div className={cn("grid w-full gap-5 lg:grid-cols-2 2xl:grid-cols-3", className)}>
      {children}
    </div>
  )
}
