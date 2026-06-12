import { motion } from "framer-motion"
import { useState, useMemo, useEffect } from "react"
import { Play, Square as Stop, RefreshCw, Terminal, Clock, AlertCircle } from "lucide-react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { useSchedulerStore } from "../shared/store/scheduler"
import {
  startScheduler,
  stopScheduler,
  restartScheduler,
  runScheduleNow,
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

export function Scheduler() {
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const schedulers = useSchedulerStore((state) => state.schedulers)
  const phpAvailable = useSchedulerStore((state) => state.phpAvailable)
  const lastAction = useSchedulerStore((state) => state.lastAction)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [executingDomain, setExecutingDomain] = useState<string | null>(null)

  useEffect(() => {
    if (lastAction && lastAction.domain === executingDomain) {
      const t = setTimeout(() => {
        setExecutingDomain(null)
        useSchedulerStore.getState().setLastAction(null)
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [lastAction, executingDomain])

  const isRunning = (serviceId: string) => rawServices[serviceId]?.state === "running"

  const domainOptions = useMemo(
    () =>
      schedulers.map((t) => ({
        domain: t.domain,
        label: t.site_name,
        running: isRunning(t.service_id),
      })),
    [schedulers, rawServices]
  )

  const toggleCron = (domain: string, serviceId: string) => {
    setSelectedDomain(domain)
    if (!phpAvailable) {
      notify.warning("PHP required", "Install PHP for the scheduler.", "system")
      return
    }
    if (isRunning(serviceId)) stopScheduler(domain)
    else startScheduler(domain)
  }

  const executeNow = (domain: string) => {
    setSelectedDomain(domain)
    setExecutingDomain(domain)
    runScheduleNow(domain)
  }

  const rowActions = (t: (typeof schedulers)[0], active: boolean, isExecuting: boolean) =>
    isExecuting ? null : (
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button
          onClick={() => executeNow(t.domain)}
          disabled={!isConnected || !phpAvailable}
          className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold rounded shadow-sm flex items-center gap-1 disabled:opacity-40"
        >
          <Clock className="w-3.5 h-3.5" />
          Run now
        </button>
        <button
          onClick={() => toggleCron(t.domain, t.service_id)}
          disabled={!isConnected || !phpAvailable}
          className={`p-2 rounded disabled:opacity-40 ${active ? "text-red-500" : "text-zinc-450 hover:text-green-600"}`}
        >
          {active ? <Stop className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
        </button>
        <button
          onClick={() => {
            setSelectedDomain(t.domain)
            restartScheduler(t.domain)
          }}
          disabled={!active || !isConnected}
          className="p-2 rounded text-zinc-450 hover:text-blue-600 disabled:opacity-30"
        >
          <RefreshCw className="w-4.5 h-4.5" />
        </button>
        <button onClick={() => openPath(t.log_path)} disabled={!isConnected} className="p-2 rounded text-zinc-450 disabled:opacity-40">
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Task Scheduler</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Run schedule:work per site and watch task output live below.
        </p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6 pb-8">
        {!phpAvailable && isConnected && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>PHP is required for the scheduler.</span>
          </div>
        )}

        <WorkerActivityPanel
          kind="scheduler"
          title="Live scheduler output"
          selectedDomain={selectedDomain}
          domains={domainOptions}
          onSelectDomain={setSelectedDomain}
        />

        {schedulers.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">No Laravel sites found.</p>
        ) : (
          <>
            <MobileCardList>
              {schedulers.map((t) => {
                const active = isRunning(t.service_id)
                const isExecuting = executingDomain === t.domain
                return (
                  <MobileDataCard
                    key={t.domain}
                    title={t.site_name}
                    subtitle={t.command}
                    selected={selectedDomain === t.domain}
                    onSelect={() => setSelectedDomain(t.domain)}
                    badge={
                      <span className={`text-xs font-semibold ${isExecuting ? "text-blue-500" : active ? "text-emerald-600" : "text-zinc-400"}`}>
                        {isExecuting ? "Running once…" : active ? "Running" : "Idle"}
                      </span>
                    }
                    rows={[{ label: "Mode", value: t.frequency }]}
                    actions={rowActions(t, active, isExecuting)}
                  />
                )
              })}
            </MobileCardList>

            <DesktopTableOnly>
              <ResponsiveTable minWidth={760}>
                <ResponsiveTableHead>
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Command</th>
                    <th className="px-6 py-4">Mode</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </ResponsiveTableHead>
                <ResponsiveTableBody>
                  {schedulers.map((t) => {
                    const active = isRunning(t.service_id)
                    const isExecuting = executingDomain === t.domain
                    return (
                      <tr
                        key={t.domain}
                        onClick={() => setSelectedDomain(t.domain)}
                        className={`hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 cursor-pointer ${selectedDomain === t.domain ? "bg-blue-50/40 dark:bg-blue-950/10" : ""}`}
                      >
                        <td className="px-6 py-5">
                          <span className="text-sm font-semibold text-zinc-600">
                            {isExecuting ? "Running once…" : active ? "Running" : "Idle"}
                          </span>
                        </td>
                        <td className="px-6 py-5 font-bold text-zinc-800 dark:text-zinc-200">{t.site_name}</td>
                        <td className="px-6 py-5 font-mono text-xs">{t.command}</td>
                        <td className="px-6 py-5 text-xs">{t.frequency}</td>
                        <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                          {rowActions(t, active, isExecuting)}
                        </td>
                      </tr>
                    )
                  })}
                </ResponsiveTableBody>
              </ResponsiveTable>
            </DesktopTableOnly>
          </>
        )}
      </div>
    </motion.div>
  )
}
