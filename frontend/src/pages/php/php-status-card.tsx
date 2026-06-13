import { Play, Square } from "lucide-react"
import { sendCommand } from "@/shared/api/ws"
import { startServiceWithFeedback } from "@/shared/lib/service-actions"
import { formatPHPVersion, type PHPInstallation, type PHPSyncPayload } from "@/shared/store/php"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"

interface PHPStatusCardProps {
  sync: PHPSyncPayload | null
  active: PHPInstallation | undefined
  phpRunning: boolean
  connected: boolean
}

export function PHPStatusCard({ sync, active, phpRunning, connected }: PHPStatusCardProps) {
  const togglePHP = () => {
    if (phpRunning) {
      sendCommand("stop_service", { serviceId: "php" })
    } else {
      startServiceWithFeedback("php")
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Active runtime</h2>
            {sync?.php_available ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase",
                  phpRunning
                    ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
                    : "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400"
                )}
              >
                {phpRunning ? "php-cgi running" : "php-cgi stopped"}
              </Badge>
            ) : null}
          </div>
          {active ? (
            <>
              <p className="text-lg font-bold tracking-tight text-foreground">
                {formatPHPVersion(active)}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground" title={active.binary}>
                {active.binary}
              </p>
              {active.ini_path && (
                <p className="truncate font-mono text-xs text-muted-foreground" title={active.ini_path}>
                  php.ini · {active.ini_path}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {sync?.php_available ? "Select a version below." : "No PHP installation detected yet."}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {sync?.cgi_port ? (
            <span className="text-center font-mono text-xs text-muted-foreground sm:text-right">
              FastCGI · 127.0.0.1:{sync.cgi_port}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={phpRunning ? "outline" : "default"}
            className="h-9"
            disabled={!connected || !sync?.php_available}
            onClick={togglePHP}
          >
            {phpRunning ? (
              <>
                <Square className="h-3.5 w-3.5" />
                Stop PHP-CGI
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Start PHP-CGI
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
