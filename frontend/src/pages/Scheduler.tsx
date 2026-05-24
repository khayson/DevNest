import { motion } from "framer-motion"
import { Play, Square as Stop, RefreshCw, Terminal, Clock } from "lucide-react"
import { useState } from "react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { sendCommand } from "../shared/api/ws"

interface ScheduleTask {
  id: string
  siteName: string
  command: string
  frequency: string
  lastRun: string
  nextRun: string
  isRunning: boolean
}

export function Scheduler() {
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const cronMetric = rawServices["cron"]

  const [tasks, setTasks] = useState<ScheduleTask[]>([
    {
      id: "cron-1",
      siteName: "devnest-app",
      command: "php artisan schedule:run",
      frequency: "Every Minute (* * * * *)",
      lastRun: "10:52:00 (Success)",
      nextRun: "10:53:00",
      isRunning: cronMetric !== undefined && (cronMetric.MemoryBytes > 0 || cronMetric.CpuPercent > 0)
    },
    {
      id: "cron-2",
      siteName: "laravel-blog",
      command: "php artisan schedule:run",
      frequency: "Every 5 Minutes (*/5 * * * *)",
      lastRun: "10:50:00 (Success)",
      nextRun: "10:55:00",
      isRunning: false
    },
    {
      id: "cron-3",
      siteName: "my-portfolio",
      command: "php artisan backup:run",
      frequency: "Daily at 00:00 (0 0 * * *)",
      lastRun: "Yesterday 00:00 (Success)",
      nextRun: "Tonight 00:00",
      isRunning: false
    }
  ])

  const [executingId, setExecutingId] = useState<string | null>(null)
  const [executingFeedback, setExecutingFeedback] = useState<string | null>(null)

  // Sync isRunning state with the store telemetry
  const isCronRunning = (t: ScheduleTask) => {
    if (t.id === "cron-1") {
      return cronMetric !== undefined && (cronMetric.MemoryBytes > 0 || cronMetric.CpuPercent > 0)
    }
    return t.isRunning
  }

  const toggleCron = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const nextState = !isCronRunning(t)
        if (id === "cron-1") {
          sendCommand(nextState ? "start_service" : "stop_service", { serviceId: "cron" })
        }
        return { ...t, isRunning: nextState }
      }
      return t
    }))
  }

  const executeNow = (id: string) => {
    setExecutingId(id)
    setExecutingFeedback("Executing php artisan schedule:run...")
    
    setTimeout(() => {
      setExecutingFeedback("Completed! Exit Code: 0 (No tasks to run)")
      setTimeout(() => {
        setExecutingId(null)
        setExecutingFeedback(null)
        
        // Update last run timestamp to now
        setTasks(tasks.map(t => t.id === id ? {
          ...t, 
          lastRun: `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (Success)`
        } : t))
      }, 2000)
    }, 1200)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Task Scheduler</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">Manage and monitor Artisan cron schedulers (`artisan schedule:work`) and manually trigger scheduled commands.</p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">
        {/* Schedulers Management Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-left text-sm text-zinc-500 dark:text-zinc-400">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Project</th>
              <th scope="col" className="px-6 py-4">Scheduler Command</th>
              <th scope="col" className="px-6 py-4">Frequency</th>
              <th scope="col" className="px-6 py-4">Last Executed</th>
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tasks.map((t) => {
              const active = isCronRunning(t)
              const isExecuting = executingId === t.id
              
              return (
                <tr key={t.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-450'}`} />
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-450">
                        {active ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-zinc-800 dark:text-zinc-200">
                    {t.siteName}
                  </td>
                  <td className="px-6 py-5">
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-850 dark:text-zinc-200 px-2 py-0.5 rounded text-xs font-mono">
                      {t.command}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-zinc-650 dark:text-zinc-350">
                    {t.frequency}
                  </td>
                  <td className="px-6 py-5 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                    {t.lastRun}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {isExecuting ? (
                      <div className="flex items-center justify-end space-x-2 text-xs text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{executingFeedback}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => toggleCron(t.id)}
                          disabled={!isConnected}
                          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors disabled:opacity-40
                            ${active ? 'text-red-500' : 'text-zinc-450 hover:text-green-600'}`}
                          title={active ? "Stop Scheduler Daemon" : "Start Scheduler Daemon"}
                        >
                          {active ? <Stop className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
                        </button>
                        <button
                          onClick={() => executeNow(t.id)}
                          disabled={!isConnected}
                          className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded shadow-sm flex items-center space-x-1"
                          title="Run php artisan schedule:run instantly"
                        >
                          <Terminal className="w-3.5 h-3.5 text-zinc-450" />
                          <span>Run Now</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Info Card */}
      <div className="p-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-xl flex items-start space-x-4">
        <Clock className="w-6 h-6 text-blue-500 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">How schedule:work runs locally</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            DevNest runs the Artisan scheduler daemon in the background, executing `schedule:run` automatically every minute. There is no need to configure Windows Task Scheduler or host cron utilities.
          </p>
        </div>
      </div>
      </div>
    </motion.div>
  )
}
