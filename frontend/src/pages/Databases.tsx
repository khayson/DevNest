import { motion } from "framer-motion"
import { Database, Play, Square as Stop, RefreshCw, Copy, Folder, Check, Terminal, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { useDatabasesStore, formatBytes } from "../shared/store/databases"
import { sendCommand, openPath, syncDatabases } from "../shared/api/ws"
import { notify } from "../shared/store/notifications"

export function Databases() {
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const dbServices = useDatabasesStore((state) => state.services)
  const sqliteFiles = useDatabasesStore((state) => state.sqliteFiles)
  const phpAvailable = useDatabasesStore((state) => state.phpAvailable)
  const migrationStatus = useDatabasesStore((state) => state.migrationStatus)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [migratingDomain, setMigratingDomain] = useState<string | null>(null)

  useEffect(() => {
    if (migrationStatus && migrationStatus.domain === migratingDomain) {
      const timer = setTimeout(() => {
        setMigratingDomain(null)
        useDatabasesStore.getState().setMigrationStatus(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [migrationStatus, migratingDomain])

  const copyToClipboard = (str: string, id: string) => {
    navigator.clipboard.writeText(str)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const runMigration = (domain: string, fresh: boolean) => {
    if (!phpAvailable) {
      notify.warning("PHP required", "Install PHP to run artisan migrations from DevNest.", "system")
      return
    }
    setMigratingDomain(domain)
    sendCommand("run_migration", { domain, fresh })
  }

  const handleScan = () => {
    if (syncDatabases()) {
      notify.info("Scanning sites", "Refreshing SQLite files from registered sites…", "system")
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Databases</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Start MySQL, PostgreSQL, or Redis when installed. Copy connection strings and run Laravel migrations on SQLite sites.
        </p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">
        <div className="space-y-4">
        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Database Servers</h2>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-left text-sm text-zinc-500 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4">Database</th>
                <th scope="col" className="px-6 py-4">Port</th>
                <th scope="col" className="px-6 py-4">Credentials</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {dbServices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                    {isConnected ? "Waiting for database sync from daemon…" : "Connect to the daemon to load database services."}
                  </td>
                </tr>
              ) : dbServices.map((db) => {
                const metric = rawServices[db.id]
                const isRunning = metric?.state === "running"
                const canToggle = db.available && isConnected
                
                return (
                  <tr key={db.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400'}`} />
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-400">
                          {!db.available ? "Not installed" : isRunning ? "Running" : "Stopped"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-zinc-150 dark:bg-zinc-800 rounded">
                          <Database className="w-4.5 h-4.5 text-blue-500 dark:text-blue-400" />
                        </div>
                        <div>
                          <span className="font-bold text-zinc-850 dark:text-zinc-200 text-sm block">{db.name}</span>
                          <span className="text-xs text-zinc-400">v{db.version}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-sm text-zinc-650 dark:text-zinc-350">
                      {db.port}
                    </td>
                    <td className="px-6 py-5">
                      {db.available ? (
                        <div className="text-xs space-y-0.5">
                          <div><span className="text-zinc-400 font-semibold">User:</span> <span className="font-mono text-zinc-750 dark:text-zinc-250">{db.username}</span></div>
                          <div><span className="text-zinc-400 font-semibold">Pass:</span> <span className="text-zinc-500 italic">{db.password}</span></div>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 italic">Binary not found on this machine</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2.5">
                        <button 
                          onClick={() => copyToClipboard(db.conn_str, db.id)}
                          disabled={!db.available}
                          className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded-md shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-40"
                          title="Copy Connection String"
                        >
                          {copiedId === db.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy URI</span>
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => sendCommand(isRunning ? "stop_service" : "start_service", { serviceId: db.id })}
                          disabled={!canToggle}
                          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors disabled:opacity-40
                            ${isRunning ? 'text-red-500 hover:text-red-600' : 'text-zinc-450 hover:text-green-600'}`}
                          title={!db.available ? "Install the database server first" : isRunning ? "Stop Service" : "Start Service"}
                        >
                          {isRunning ? <Stop className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">SQLite Database Files</h2>
          <button
            onClick={handleScan}
            disabled={!isConnected}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1.5 font-medium disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Projects</span>
          </button>
        </div>

        {!phpAvailable && isConnected && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>PHP is required to run artisan migrations. Install PHP from the PHP tab or run <code className="font-mono">.\scripts\install-php.ps1</code>.</span>
          </div>
        )}

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 shadow-sm overflow-hidden">
          <table className="w-full border-collapse text-left text-sm text-zinc-500 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-4">Site</th>
                <th scope="col" className="px-6 py-4">Database File</th>
                <th scope="col" className="px-6 py-4">File Size</th>
                <th scope="col" className="px-6 py-4">Full Path</th>
                <th scope="col" className="px-6 py-4 text-right">Artisan Migrations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sqliteFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                    No SQLite files found. Add sites in the Sites tab — DevNest scans <code className="font-mono text-zinc-500">database/database.sqlite</code> under each project.
                  </td>
                </tr>
              ) : sqliteFiles.map((sqlite) => {
                const isMigrating = migratingDomain === sqlite.domain
                const statusForRow = migrationStatus?.domain === sqlite.domain ? migrationStatus : null
                
                return (
                  <tr key={sqlite.domain} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-5 font-bold text-zinc-800 dark:text-zinc-200">
                      {sqlite.site_name}
                    </td>
                    <td className="px-6 py-5 font-semibold text-blue-600 dark:text-blue-400">
                      {sqlite.db_file}
                    </td>
                    <td className="px-6 py-5 text-zinc-650 dark:text-zinc-350">
                      {formatBytes(sqlite.size_bytes)}
                    </td>
                    <td className="px-6 py-5 text-xs font-mono text-zinc-400 max-w-[200px] truncate" title={sqlite.path}>
                      {sqlite.path}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isMigrating ? (
                        <div className="flex items-center justify-end space-x-2 text-xs text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{statusForRow?.message ?? "Running migration…"}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => runMigration(sqlite.domain, false)}
                            disabled={!phpAvailable || !isConnected}
                            className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded shadow-sm flex items-center space-x-1 disabled:opacity-40"
                            title="Run php artisan migrate"
                          >
                            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Migrate</span>
                          </button>
                          <button 
                            onClick={() => runMigration(sqlite.domain, true)}
                            disabled={!phpAvailable || !isConnected}
                            className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded shadow-sm flex items-center space-x-1 disabled:opacity-40"
                            title="Run php artisan migrate:fresh --seed"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Fresh</span>
                          </button>
                          <button 
                            onClick={() => openPath(sqlite.path.replace(/\\[^\\]+$/, ""))}
                            disabled={!isConnected}
                            className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-450 hover:text-zinc-700 transition-colors disabled:opacity-40"
                            title="Open Database Directory"
                          >
                            <Folder className="w-4 h-4" />
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
      </div>
      </div>
    </motion.div>
  )
}
