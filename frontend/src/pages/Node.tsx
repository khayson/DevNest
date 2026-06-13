import { RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { syncNode, setActiveNode, startNodeDev, stopNodeDev, restartNodeDev } from "@/shared/api/ws"
import { isNodeActive, useNodeStore } from "@/shared/store/node"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { PageLayout, PageGrid } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { WorkerActivityPanel } from "@/widgets/WorkerActivityPanel"
import { NodeStatusCard } from "@/pages/node/node-status-card"
import { NodeInstallations } from "@/pages/node/node-installations"
import { NodeDevServers } from "@/pages/node/node-dev-servers"

export function Node() {
  const sync = useNodeStore((s) => s.sync)
  const connected = useTelemetryStore((s) => s.isConnected)
  const rawServices = useTelemetryStore((s) => s.services) || {}
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  const installations = sync?.installations ?? []
  const servers = sync?.servers ?? []
  const active = useMemo(
    () => installations.find((i) => isNodeActive(i, sync)),
    [installations, sync]
  )

  useEffect(() => {
    if (connected) syncNode()
  }, [connected])

  const isRunning = (serviceId: string) => rawServices[serviceId]?.state === "running"

  const domainOptions = useMemo(
    () =>
      servers.map((s) => ({
        domain: s.domain,
        label: s.site_name,
        running: isRunning(s.service_id),
      })),
    [servers, rawServices]
  )

  const noNode = connected && sync && !sync.node_available

  return (
    <PageLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Discover Node on PATH or nvm, pick an active version, and run{" "}
          <code className="font-mono text-xs">npm run dev</code> for frontend sites.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={!connected}
          onClick={() => syncNode()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {noNode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          No Node.js found. Install from{" "}
          <a href="https://nodejs.org" className="underline" target="_blank" rel="noreferrer">
            nodejs.org
          </a>{" "}
          or nvm-windows, then restart the daemon.
        </div>
      )}

      <NodeStatusCard sync={sync} active={active} connected={connected} />

      <PageGrid className="lg:grid-cols-1 2xl:grid-cols-2">
        <NodeInstallations
          installations={installations}
          sync={sync}
          connected={connected}
          onSetActive={setActiveNode}
        />
        {servers.length > 0 ? (
          <NodeDevServers
            servers={servers}
            connected={connected}
            nodeAvailable={Boolean(sync?.node_available)}
            isRunning={isRunning}
            onStart={startNodeDev}
            onStop={stopNodeDev}
            onRestart={restartNodeDev}
            selectedDomain={selectedDomain}
            onSelectDomain={setSelectedDomain}
          />
        ) : null}
      </PageGrid>

      {servers.length > 0 && (
        <WorkerActivityPanel
          kind="node"
          title="Live dev server output"
          selectedDomain={selectedDomain}
          domains={domainOptions}
          onSelectDomain={setSelectedDomain}
        />
      )}
    </PageLayout>
  )
}
