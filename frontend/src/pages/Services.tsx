import { Play, RefreshCw, Square as Stop } from "lucide-react"
import { useMemo } from "react"
import { sendCommand } from "@/shared/api/ws"
import { startServiceWithFeedback } from "@/shared/lib/service-actions"
import { notify } from "@/shared/store/notifications"
import { useTelemetryStore } from "@/shared/store/telemetry"
import {
  LIVE_SERVICES,
  countRunningServices,
  getServiceBrandStyle,
} from "@/shared/lib/live-services"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { SettingsGroup } from "@/shared/ui/settings-group"
import {
  DesktopTableOnly,
  MobileCardList,
  MobileDataCard,
  ResponsiveTable,
  ResponsiveTableBody,
  ResponsiveTableHead,
} from "@/shared/ui/responsive-table"
import { cn } from "@/shared/lib/utils"

export function Services() {
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const runningCount = countRunningServices(rawServices)

  const services = useMemo(
    () =>
      LIVE_SERVICES.map((s) => {
        const metric = rawServices[s.id]
        const isRunning = metric?.state === "running"
        return { ...s, isRunning, metric }
      }),
    [rawServices]
  )

  return (
    <PageLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {isConnected
            ? `${runningCount}/${LIVE_SERVICES.length} daemon services running — mail, DNS, Caddy, databases, and extras.`
            : "Start/stop every service registered with the Go orchestrator."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={!isConnected}
            onClick={() => {
              if (sendCommand("start_all")) notify.info("Starting all services…", undefined, "service")
            }}
          >
            <Play className="h-4 w-4 fill-current" />
            Start all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!isConnected}
            onClick={() => {
              if (sendCommand("stop_all")) notify.info("Stopping all services…", undefined, "service")
            }}
          >
            <Stop className="h-4 w-4" />
            Stop all
          </Button>
        </div>
      </div>

      <SettingsGroup
        title="Registered services"
        description="Each row maps to a supervised process in the daemon. Missing binaries are skipped at startup."
      >
        <DesktopTableOnly>
          <ResponsiveTable minWidth={720} className="rounded-none border-0 shadow-none">
            <ResponsiveTableHead>
              <tr>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Port</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </ResponsiveTableHead>
            <ResponsiveTableBody>
              {services.map((service) => {
                const Icon = service.icon
                const brand = getServiceBrandStyle(service, service.isRunning)
                return (
                  <tr key={service.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          service.isRunning
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            service.isRunning ? "bg-emerald-500" : "bg-zinc-400"
                          )}
                        />
                        {service.isRunning ? "Running" : "Stopped"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                            brand.bg,
                            brand.border,
                            service.isRunning && service.brand.active.glow
                          )}
                        >
                          <Icon className={cn("h-4 w-4", brand.icon)} strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{service.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{service.hint}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{service.port}</td>
                    <td className="px-4 py-3">
                      <ServiceActions service={service} isConnected={isConnected} />
                    </td>
                  </tr>
                )
              })}
            </ResponsiveTableBody>
          </ResponsiveTable>
        </DesktopTableOnly>

        <MobileCardList className="p-4">
          {services.map((service) => {
            const Icon = service.icon
            const brand = getServiceBrandStyle(service, service.isRunning)
            return (
              <MobileDataCard
                key={service.id}
                title={service.name}
                subtitle={service.hint}
                badge={
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      service.isRunning
                        ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
                        : ""
                    )}
                  >
                    {service.isRunning ? "Running" : "Stopped"}
                  </Badge>
                }
                rows={[
                  { label: "Port", value: service.port },
                  { label: "Version", value: service.version },
                ]}
                actions={
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "mr-auto flex h-8 w-8 items-center justify-center rounded-lg border",
                        brand.bg,
                        brand.border
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", brand.icon)} />
                    </div>
                    <ServiceActions service={service} isConnected={isConnected} compact />
                  </div>
                }
              />
            )
          })}
        </MobileCardList>
      </SettingsGroup>
    </PageLayout>
  )
}

function ServiceActions({
  service,
  isConnected,
  compact = false,
}: {
  service: { id: string; name: string; isRunning: boolean }
  isConnected: boolean
  compact?: boolean
}) {
  const btnClass = compact ? "h-8 w-8 p-0" : "h-8 w-8"

  return (
    <div className={cn("flex items-center justify-end gap-1", !compact && "w-full")}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={btnClass}
        disabled={service.isRunning || !isConnected}
        title="Start"
        onClick={() => startServiceWithFeedback(service.id)}
      >
        <Play className="h-4 w-4 text-emerald-600" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={btnClass}
        disabled={!service.isRunning || !isConnected}
        title="Restart"
        onClick={() => {
          if (sendCommand("restart_service", { serviceId: service.id })) {
            notify.info(`Restarting ${service.name}…`, undefined, "service")
          }
        }}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={btnClass}
        disabled={!service.isRunning || !isConnected}
        title="Stop"
        onClick={() => {
          if (sendCommand("stop_service", { serviceId: service.id })) {
            notify.info(`Stopping ${service.name}…`, undefined, "service")
          }
        }}
      >
        <Stop className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}
