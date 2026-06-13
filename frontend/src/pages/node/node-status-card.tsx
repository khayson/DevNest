import { Check } from "lucide-react"
import { type NodeInstallation, type NodeSyncPayload } from "@/shared/store/node"
import { Badge } from "@/shared/ui/badge"
import { cn } from "@/shared/lib/utils"

interface NodeStatusCardProps {
  sync: NodeSyncPayload | null
  active: NodeInstallation | undefined
  connected: boolean
}

export function NodeStatusCard({ sync, active, connected }: NodeStatusCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Active runtime</h2>
            {sync?.node_available ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase",
                  active
                    ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
                    : "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400"
                )}
              >
                {active ? "Version selected" : "None selected"}
              </Badge>
            ) : null}
          </div>
          {active ? (
            <>
              <p className="text-lg font-bold tracking-tight text-foreground">{active.label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground" title={active.binary}>
                {active.binary}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {!connected
                ? "Connect to the daemon to discover Node."
                : sync?.node_available
                  ? "Select a version below."
                  : "No Node.js installation detected yet."}
            </p>
          )}
        </div>
        {active && (
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Active for dev servers
          </div>
        )}
      </div>
    </div>
  )
}
