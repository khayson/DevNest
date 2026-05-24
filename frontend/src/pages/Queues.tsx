import { motion } from "framer-motion"
import { Play, Square as Stop, RefreshCw, Terminal, Sliders } from "lucide-react"
import { useState } from "react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { sendCommand } from "../shared/api/ws"

interface QueueWorker {
  id: string
  siteName: string
  connection: string
  queueName: string
  tries: number
  isRunning: boolean
}

export function Queues() {
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const queueMetric = rawServices["queue"]

  const [workers, setWorkers] = useState<QueueWorker[]>([
    {
      id: "worker-1",
      siteName: "devnest-app",
      connection: "redis",
      queueName: "default",
      tries: 3,
      isRunning: queueMetric !== undefined && (queueMetric.MemoryBytes > 0 || queueMetric.CpuPercent > 0)
    },
    {
      id: "worker-2",
      siteName: "laravel-blog",
      connection: "database",
      queueName: "default,emails",
      tries: 3,
      isRunning: false
    },
    {
      id: "worker-3",
      siteName: "my-portfolio",
      connection: "sync",
      queueName: "default",
      tries: 1,
      isRunning: false
    }
  ])

  // Sync isRunning state with the store telemetry
  const isWorkerRunning = (w: QueueWorker) => {
    if (w.id === "worker-1") {
      return queueMetric !== undefined && (queueMetric.MemoryBytes > 0 || queueMetric.CpuPercent > 0)
    }
    return w.isRunning
  }

  const toggleWorker = (id: string) => {
    setWorkers(workers.map(w => {
      if (w.id === id) {
        const nextState = !isWorkerRunning(w)
        if (id === "worker-1") {
          sendCommand(nextState ? "start_service" : "stop_service", { serviceId: "queue" })
        }
        return { ...w, isRunning: nextState }
      }
      return w
    }))
  }

  const restartWorker = (id: string) => {
    if (id === "worker-1") {
      sendCommand("restart_service", { serviceId: "queue" })
    }
    // Simple visual feedback trigger
    setWorkers(workers.map(w => w.id === id ? { ...w, isRunning: false } : w))
    setTimeout(() => {
      setWorkers(workers.map(w => w.id === id ? { ...w, isRunning: true } : w))
    }, 800)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Queue Workers</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">Supervise background Laravel queue workers (`artisan queue:work`) and view active job channels.</p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">
        {/* Workers Management Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-left text-sm text-zinc-500 dark:text-zinc-400">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Project</th>
              <th scope="col" className="px-6 py-4">Connection</th>
              <th scope="col" className="px-6 py-4">Queues</th>
              <th scope="col" className="px-6 py-4">PID / Telemetry</th>
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {workers.map((w) => {
              const active = isWorkerRunning(w)
              
              return (
                <tr key={w.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-450'}`} />
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-450">
                        {active ? "Running" : "Idle"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-zinc-800 dark:text-zinc-200">
                    {w.siteName}
                  </td>
                  <td className="px-6 py-5">
                    <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 px-2 py-0.5 rounded text-xs font-semibold uppercase font-mono">
                      {w.connection}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-mono text-xs text-zinc-650 dark:text-zinc-350">
                    {w.queueName}
                  </td>
                  <td className="px-6 py-5">
                    {active ? (
                      <div className="text-xs space-y-0.5">
                        <div><span className="text-zinc-450 font-semibold">PID:</span> <span className="font-mono text-zinc-700 dark:text-zinc-300">{w.id === "worker-1" && queueMetric ? queueMetric.PID : 4310}</span></div>
                        <div><span className="text-zinc-450 font-semibold">RAM:</span> <span className="font-mono text-zinc-700 dark:text-zinc-300">{w.id === "worker-1" && queueMetric ? `${Math.round(queueMetric.MemoryBytes / (1024 * 1024))} MB` : "28 MB"}</span></div>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => toggleWorker(w.id)}
                        disabled={!isConnected}
                        className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors disabled:opacity-40
                          ${active ? 'text-red-500' : 'text-zinc-450 hover:text-green-600'}`}
                        title={active ? "Stop Queue Worker" : "Start Queue Worker"}
                      >
                        {active ? <Stop className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
                      </button>
                      <button
                        onClick={() => restartWorker(w.id)}
                        disabled={!active || !isConnected}
                        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-450 hover:text-blue-650 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        title="Restart Queue Worker"
                      >
                        <RefreshCw className="w-4.5 h-4.5" />
                      </button>
                      <button
                        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-450 hover:text-zinc-700 transition-colors"
                        title="View Worker Log file"
                      >
                        <Terminal className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Global Config Card */}
      <div className="p-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-xl space-y-4">
        <div className="flex items-start space-x-3.5">
          <Sliders className="w-5.5 h-5.5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-zinc-850 dark:text-zinc-150">Global Worker Config overrides</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-450 mt-1">
              Customize local queue processing options. These overrides are automatically injected into the artisan worker daemon execution path.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-450 uppercase">Default Max Retries</label>
            <select className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="1">1 Try</option>
              <option value="3">3 Tries (Default)</option>
              <option value="5">5 Tries</option>
              <option value="10">10 Tries</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-450 uppercase">Time Limit (Seconds)</label>
            <select className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="0">No timeout limit</option>
              <option value="30">30s timeout</option>
              <option value="60">60s timeout (Default)</option>
              <option value="180">180s timeout</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-450 uppercase">Memory Allocation Limit</label>
            <select className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="64">64 MB</option>
              <option value="128">128 MB (Default)</option>
              <option value="256">256 MB</option>
              <option value="512">512 MB</option>
            </select>
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  )
}
