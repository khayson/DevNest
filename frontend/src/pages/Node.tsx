import { motion } from "framer-motion"
import { Check, RefreshCw, Play, Square as Stop, AlertCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { setActiveNode, startNodeDev, stopNodeDev, restartNodeDev, syncNode } from "../shared/api/ws"
import { isNodeActive, useNodeStore } from "../shared/store/node"
import { useTelemetryStore } from "../shared/store/telemetry"
import { WorkerActivityPanel } from "../widgets/WorkerActivityPanel"
import {
  ResponsiveTable,
  ResponsiveTableHead,
  ResponsiveTableBody,
  MobileCardList,
  MobileDataCard,
  DesktopTableOnly,
} from "../shared/ui/responsive-table"

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
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Node.js</h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Discover Node on PATH or nvm, pick an active version, and run <code className="font-mono text-sm">npm run dev</code> for frontend sites.
          </p>
        </div>
        <button
          type="button"
          onClick={() => syncNode()}
          disabled={!connected}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6 pb-6">
        {noNode && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            No Node.js found. Install from <a href="https://nodejs.org" className="underline" target="_blank" rel="noreferrer">nodejs.org</a> or nvm-windows, then restart the daemon.
          </div>
        )}

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
              Active: {active?.label ?? sync?.active_label ?? "None"}
            </div>
            {sync?.active_path && (
              <div className="text-xs font-mono text-zinc-500 mt-1 truncate max-w-md">{sync.active_path}</div>
            )}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/50 divide-y divide-zinc-200 dark:divide-zinc-800">
          {installations.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">Waiting for Node discovery…</p>
          ) : (
            installations.map((inst) => (
              <div key={inst.binary} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{inst.label}</span>
                  {isNodeActive(inst, sync) && (
                    <span className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900">
                      Active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActiveNode(inst.binary)}
                  disabled={!connected || isNodeActive(inst, sync)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border disabled:opacity-40 flex items-center gap-1"
                >
                  {isNodeActive(inst, sync) ? <Check className="w-3.5 h-3.5" /> : null}
                  {isNodeActive(inst, sync) ? "Selected" : "Set active"}
                </button>
              </div>
            ))
          )}
        </div>

        {servers.length > 0 && (
          <>
            <WorkerActivityPanel
              kind="node"
              title="Live dev server output"
              selectedDomain={selectedDomain}
              domains={domainOptions}
              onSelectDomain={setSelectedDomain}
            />

            <MobileCardList>
              {servers.map((s) => {
                const activeDev = isRunning(s.service_id)
                return (
                  <MobileDataCard
                    key={s.domain}
                    title={s.site_name}
                    subtitle={s.dev_command}
                    selected={selectedDomain === s.domain}
                    onSelect={() => setSelectedDomain(s.domain)}
                    badge={
                      <span className={`text-xs font-semibold ${activeDev ? "text-emerald-600" : "text-zinc-400"}`}>
                        {activeDev ? "Running" : "Stopped"}
                      </span>
                    }
                    rows={[
                      { label: "Port", value: String(s.port) },
                      { label: "Vite", value: s.uses_vite ? "Yes" : "No" },
                    ]}
                    actions={
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedDomain(s.domain)
                            activeDev ? stopNodeDev(s.domain) : startNodeDev(s.domain)
                          }}
                          disabled={!connected || !sync?.node_available}
                          className={`p-2 rounded ${activeDev ? "text-red-500" : "text-green-600"}`}
                        >
                          {activeDev ? <Stop className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => restartNodeDev(s.domain)}
                          disabled={!activeDev || !connected}
                          className="p-2 rounded text-zinc-450 disabled:opacity-30"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    }
                  />
                )
              })}
            </MobileCardList>

            <DesktopTableOnly>
              <ResponsiveTable minWidth={640}>
                <ResponsiveTableHead>
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Site</th>
                    <th className="px-6 py-4">Port</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </ResponsiveTableHead>
                <ResponsiveTableBody>
                  {servers.map((s) => {
                    const activeDev = isRunning(s.service_id)
                    return (
                      <tr
                        key={s.domain}
                        onClick={() => setSelectedDomain(s.domain)}
                        className={`cursor-pointer hover:bg-zinc-50/50 ${selectedDomain === s.domain ? "bg-blue-50/40 dark:bg-blue-950/10" : ""}`}
                      >
                        <td className="px-6 py-4">{activeDev ? "Running" : "Stopped"}</td>
                        <td className="px-6 py-4 font-semibold">{s.site_name}</td>
                        <td className="px-6 py-4 font-mono">{s.port}</td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => (activeDev ? stopNodeDev(s.domain) : startNodeDev(s.domain))}
                            disabled={!connected}
                            className="p-2 inline-flex"
                          >
                            {activeDev ? <Stop className="w-4 h-4 text-red-500" /> : <Play className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </ResponsiveTableBody>
              </ResponsiveTable>
            </DesktopTableOnly>
          </>
        )}

        {sync?.node_available && servers.length === 0 && (
          <div className="flex items-start gap-2 text-sm text-zinc-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>No sites with a <code className="font-mono text-xs">package.json</code> dev script. Add a frontend project in Sites.</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
