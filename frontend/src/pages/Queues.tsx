import { motion } from "framer-motion"
import { useState, useMemo } from "react"
import { Play, Square as Stop, RefreshCw, Terminal, Sliders, AlertCircle } from "lucide-react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { useQueuesStore } from "../shared/store/queues"
import {
  startQueueWorker,
  stopQueueWorker,
  restartQueueWorker,
  updateQueueConfig,
  openPath,
} from "../shared/api/ws"
import { notify } from "../shared/store/notifications"
import { WorkerActivityPanel } from "../widgets/WorkerActivityPanel"
import {
  ResponsiveTable,
  ResponsiveTableHead,
  ResponsiveTableBody,
  MobileCardList,
  MobileDataCard,
  DesktopTableOnly,
} from "../shared/ui/responsive-table"

export function Queues() {
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const workers = useQueuesStore((state) => state.workers)
  const defaults = useQueuesStore((state) => state.defaults)
  const phpAvailable = useQueuesStore((state) => state.phpAvailable)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  const isRunning = (serviceId: string) => rawServices[serviceId]?.state === "running"

  const domainOptions = useMemo(
    () =>
      workers.map((w) => ({
        domain: w.domain,
        label: w.site_name,
        running: isRunning(w.service_id),
      })),
    [workers, rawServices]
  )

  const toggleWorker = (domain: string, serviceId: string, supportsWorker: boolean) => {
    setSelectedDomain(domain)
    if (!phpAvailable) {
      notify.warning("PHP required", "Install PHP to run queue workers.", "system")
      return
    }
    if (!supportsWorker) {
      notify.info("Sync driver", "QUEUE_CONNECTION=sync — no background worker needed.", "system")
      return
    }
    if (isRunning(serviceId)) stopQueueWorker(domain)
    else startQueueWorker(domain)
  }

  const saveDefaults = (field: keyof typeof defaults, value: string | number) => {
    const next = { ...defaults, [field]: value }
    if (updateQueueConfig(next)) {
      notify.info("Queue config saved", "Defaults apply to all workers on next start.", "system")
    }
  }

  const rowActions = (w: (typeof workers)[0], active: boolean) => (
    <div className="flex items-center justify-end space-x-2">
      <button
        onClick={() => toggleWorker(w.domain, w.service_id, w.supports_worker)}
        disabled={!isConnected || !w.supports_worker || !phpAvailable}
        className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors disabled:opacity-40
          ${active ? "text-red-500" : "text-zinc-450 hover:text-green-600"}`}
      >
        {active ? <Stop className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
      </button>
      <button
        onClick={() => {
          setSelectedDomain(w.domain)
          restartQueueWorker(w.domain)
        }}
        disabled={!active || !isConnected}
        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-450 hover:text-blue-600 transition-colors disabled:opacity-30"
      >
        <RefreshCw className="w-4.5 h-4.5" />
      </button>
      <button
        onClick={() => openPath(w.log_path)}
        disabled={!isConnected}
        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-450 transition-colors disabled:opacity-40"
      >
        <Terminal className="w-4.5 h-4.5" />
      </button>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Queue Workers</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Supervise Laravel queue workers per site. Live output appears below — no need to open the Logs tab for worker activity.
        </p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6 pb-8">
        {!phpAvailable && isConnected && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>PHP is required to run queue workers.</span>
          </div>
        )}

        <WorkerActivityPanel
          kind="queue"
          title="Live queue output"
          selectedDomain={selectedDomain}
          domains={domainOptions}
          onSelectDomain={setSelectedDomain}
        />

        {workers.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">No Laravel sites with queue workers. Add sites in the Sites tab.</p>
        ) : (
          <>
            <MobileCardList>
              {workers.map((w) => {
                const active = isRunning(w.service_id)
                const metric = rawServices[w.service_id]
                return (
                  <MobileDataCard
                    key={w.domain}
                    title={w.site_name}
                    subtitle={w.domain}
                    selected={selectedDomain === w.domain}
                    onSelect={() => setSelectedDomain(w.domain)}
                    badge={
                      <span className={`text-xs font-semibold ${active ? "text-emerald-600" : w.supports_worker ? "text-zinc-400" : "text-amber-500"}`}>
                        {!w.supports_worker ? "Sync" : active ? "Running" : "Idle"}
                      </span>
                    }
                    rows={[
                      { label: "Connection", value: w.connection },
                      { label: "Queues", value: w.queues },
                      {
                        label: "PID",
                        value: active && metric?.pid ? String(metric.pid) : "—",
                      },
                    ]}
                    actions={rowActions(w, active)}
                  />
                )
              })}
            </MobileCardList>

            <DesktopTableOnly>
              <ResponsiveTable minWidth={860}>
                <ResponsiveTableHead>
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Connection</th>
                    <th className="px-6 py-4">Queues</th>
                    <th className="px-6 py-4">PID</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </ResponsiveTableHead>
                <ResponsiveTableBody>
                  {workers.map((w) => {
                    const active = isRunning(w.service_id)
                    const metric = rawServices[w.service_id]
                    return (
                      <tr
                        key={w.domain}
                        onClick={() => setSelectedDomain(w.domain)}
                        className={`hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 cursor-pointer ${selectedDomain === w.domain ? "bg-blue-50/40 dark:bg-blue-950/10" : ""}`}
                      >
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center gap-2 text-sm font-semibold ${active ? "text-emerald-600" : "text-zinc-500"}`}>
                            <span className={`w-2 h-2 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                            {!w.supports_worker ? "Sync" : active ? "Running" : "Idle"}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-bold text-zinc-800 dark:text-zinc-200">{w.site_name}</td>
                        <td className="px-6 py-5 font-mono text-xs uppercase">{w.connection}</td>
                        <td className="px-6 py-5 font-mono text-xs">{w.queues}</td>
                        <td className="px-6 py-5 font-mono text-xs">{active && metric?.pid ? metric.pid : "—"}</td>
                        <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                          {rowActions(w, active)}
                        </td>
                      </tr>
                    )
                  })}
                </ResponsiveTableBody>
              </ResponsiveTable>
            </DesktopTableOnly>
          </>
        )}

        <div className="p-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-xl space-y-4">
          <div className="flex items-start gap-3">
            <Sliders className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Global worker defaults</h3>
              <p className="text-sm text-zinc-500 mt-1">Applied to every queue:work process.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-zinc-500 uppercase">Retries</span>
              <select
                value={defaults.tries}
                onChange={(e) => saveDefaults("tries", Number(e.target.value))}
                disabled={!isConnected}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm disabled:opacity-40"
              >
                {[1, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-zinc-500 uppercase">Timeout</span>
              <select
                value={defaults.timeout}
                onChange={(e) => saveDefaults("timeout", Number(e.target.value))}
                disabled={!isConnected}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm disabled:opacity-40"
              >
                <option value={0}>No limit</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={180}>180s</option>
              </select>
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-zinc-500 uppercase">Memory</span>
              <select
                value={defaults.memory}
                onChange={(e) => saveDefaults("memory", Number(e.target.value))}
                disabled={!isConnected}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm disabled:opacity-40"
              >
                {[64, 128, 256, 512].map((n) => (
                  <option key={n} value={n}>{n} MB</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs font-bold text-zinc-500 uppercase">Queues</span>
              <input
                type="text"
                defaultValue={defaults.queues}
                onBlur={(e) => saveDefaults("queues", e.target.value.trim() || "default")}
                disabled={!isConnected}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm font-mono disabled:opacity-40"
              />
            </label>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
