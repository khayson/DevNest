import { motion } from "framer-motion"
import { Database, Play, Square as Stop, RefreshCw, Copy, Folder, Check, Terminal } from "lucide-react"
import { useState } from "react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { sendCommand } from "../shared/api/ws"

interface DBService {
  id: string
  name: string
  version: string
  port: number
  username: string
  password: string
  connStr: string
}

interface SQLiteDB {
  siteName: string
  dbFile: string
  size: string
  path: string
}

export function Databases() {
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [migratingSite, setMigratingSite] = useState<string | null>(null)
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null)

  const dbServices: DBService[] = [
    {
      id: "mysql",
      name: "MySQL Server",
      version: "8.0",
      port: 3306,
      username: "root",
      password: "No password (default)",
      connStr: "mysql://root@127.0.0.1:3306/devnest"
    },
    {
      id: "postgres",
      name: "PostgreSQL",
      version: "16",
      port: 5432,
      username: "postgres",
      password: "postgres (default)",
      connStr: "postgresql://postgres:postgres@127.0.0.1:5432/devnest"
    },
    {
      id: "redis",
      name: "Redis",
      version: "7.2",
      port: 6379,
      username: "N/A",
      password: "No password (default)",
      connStr: "redis://127.0.0.1:6379"
    }
  ]

  const [sqliteDbs] = useState<SQLiteDB[]>([
    {
      siteName: "devnest-app",
      dbFile: "database/database.sqlite",
      size: "240 KB",
      path: "C:\\Users\\VICTUS\\Desktop\\DevNest\\database\\database.sqlite"
    },
    {
      siteName: "laravel-blog",
      dbFile: "database/database.sqlite",
      size: "1.2 MB",
      path: "C:\\Users\\VICTUS\\Desktop\\laravel-blog\\database\\database.sqlite"
    },
    {
      siteName: "my-portfolio",
      dbFile: "database/database.sqlite",
      size: "48 KB",
      path: "C:\\Users\\VICTUS\\Desktop\\my-portfolio\\database\\database.sqlite"
    }
  ])

  const copyToClipboard = (str: string, id: string) => {
    navigator.clipboard.writeText(str)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const runMigration = (siteName: string, fresh: boolean) => {
    setMigratingSite(siteName)
    setMigrationStatus(fresh ? "Running artisan migrate:fresh..." : "Running artisan migrate...")
    
    // Simulate migration running in background daemon
    setTimeout(() => {
      setMigrationStatus(fresh ? "Migration & Seeding completed successfully!" : "Migrations run successfully!")
      setTimeout(() => {
        setMigratingSite(null)
        setMigrationStatus(null)
      }, 2000)
    }, 1500)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Databases</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">Configure database credentials, copy connection strings, and run Laravel artisan migrations.</p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">
        {/* Database Services Table */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Active Database Servers</h2>
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
              {dbServices.map((db) => {
                const metric = rawServices[db.id]
                const isRunning = metric !== undefined && (metric.MemoryBytes > 0 || metric.CpuPercent > 0)
                
                return (
                  <tr key={db.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400'}`} />
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-400">
                          {isRunning ? "Running" : "Stopped"}
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
                      <div className="text-xs space-y-0.5">
                        <div><span className="text-zinc-400 font-semibold">User:</span> <span className="font-mono text-zinc-750 dark:text-zinc-250">{db.username}</span></div>
                        <div><span className="text-zinc-400 font-semibold">Pass:</span> <span className="text-zinc-500 italic">{db.password}</span></div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2.5">
                        <button 
                          onClick={() => copyToClipboard(db.connStr, db.id)}
                          className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded-md shadow-sm flex items-center space-x-1.5 transition-all"
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
                          disabled={!isConnected}
                          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors disabled:opacity-40
                            ${isRunning ? 'text-red-500 hover:text-red-600' : 'text-zinc-450 hover:text-green-600'}`}
                          title={isRunning ? "Stop Service" : "Start Service"}
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

      {/* SQLite Database Scanned Files */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">SQLite Database Files</h2>
          <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1.5 font-medium">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Projects</span>
          </button>
        </div>

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
              {sqliteDbs.map((sqlite) => {
                const isMigrating = migratingSite === sqlite.siteName
                
                return (
                  <tr key={sqlite.siteName} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-5 font-bold text-zinc-800 dark:text-zinc-200">
                      {sqlite.siteName}
                    </td>
                    <td className="px-6 py-5 font-semibold text-blue-600 dark:text-blue-400">
                      {sqlite.dbFile}
                    </td>
                    <td className="px-6 py-5 text-zinc-650 dark:text-zinc-350">
                      {sqlite.size}
                    </td>
                    <td className="px-6 py-5 text-xs font-mono text-zinc-400 max-w-[200px] truncate" title={sqlite.path}>
                      {sqlite.path}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isMigrating ? (
                        <div className="flex items-center justify-end space-x-2 text-xs text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{migrationStatus}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => runMigration(sqlite.siteName, false)}
                            className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded shadow-sm flex items-center space-x-1"
                            title="Run php artisan migrate"
                          >
                            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Migrate</span>
                          </button>
                          <button 
                            onClick={() => runMigration(sqlite.siteName, true)}
                            className="px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 text-xs font-semibold rounded shadow-sm flex items-center space-x-1"
                            title="Run php artisan migrate:fresh --seed"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Fresh</span>
                          </button>
                          <button 
                            className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-450 hover:text-zinc-700 transition-colors"
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
