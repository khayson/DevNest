import {
  ChevronDown,
  ChevronRight,
  Database,
  FolderOpen,
  Play,
  RefreshCw,
  Search,
  Square,
  Table2,
  Terminal,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { cn } from "@/shared/lib/utils"
import { engineLabel, type DbEngine, type ExplorerDatabase } from "@/shared/lib/databases-ui"
import type { DBServiceInfo } from "@/shared/store/databases"

const ENGINES: DbEngine[] = ["sqlite", "mysql", "mariadb", "postgres", "valkey"]

function dbCacheKey(engine: DbEngine, databaseId: string) {
  const id = databaseId.trim()
  return engine === "sqlite" ? id.replace(/\\/g, "/") : id
}

interface DbSchemaTreeProps {
  engine: DbEngine
  onEngineChange: (engine: DbEngine) => void
  databases: ExplorerDatabase[]
  tablesByDatabase: Record<string, string[]>
  expandedDatabase: string | null
  onExpandDatabase: (id: string | null) => void
  selectedDatabase: string
  selectedTable: string
  onSelectTable: (databaseId: string, table: string) => void
  schemaLoading: boolean
  schemaError?: string
  isConnected: boolean
  onRefresh: () => void
  activeServer: DBServiceInfo | null | undefined
  serverRunning: boolean
  onToggleServer: () => void
  phpAvailable: boolean
  onMigrate: (fresh: boolean) => void
  onOpenFolder: () => void
  migratingMessage?: string | null
  mobile?: boolean
  onCloseMobile?: () => void
}

export function DbSchemaTree({
  engine,
  onEngineChange,
  databases,
  tablesByDatabase,
  expandedDatabase,
  onExpandDatabase,
  selectedDatabase,
  selectedTable,
  onSelectTable,
  schemaLoading,
  schemaError,
  isConnected,
  onRefresh,
  activeServer,
  serverRunning,
  onToggleServer,
  phpAvailable,
  onMigrate,
  onOpenFolder,
  migratingMessage,
  mobile,
  onCloseMobile,
}: DbSchemaTreeProps) {
  const [filter, setFilter] = useState("")

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return databases
    return databases.filter((db) => {
      const nameMatch = db.name.toLowerCase().includes(q) || db.id.toLowerCase().includes(q)
      const tables = tablesByDatabase[db.id] ?? []
      const tableMatch = tables.some((t) => t.toLowerCase().includes(q))
      return nameMatch || tableMatch
    })
  }, [databases, filter, tablesByDatabase])

  const dbDisabled = engine !== "sqlite" && (!activeServer?.available || !serverRunning)

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <div className="shrink-0 border-b border-slate-800 px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Schema
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white"
              onClick={onRefresh}
              disabled={!isConnected}
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", schemaLoading && "animate-spin")} />
            </Button>
            {mobile && onCloseMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
                onClick={onCloseMobile}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-900 p-1">
          {ENGINES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onEngineChange(e)}
              className={cn(
                "rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                engine === e
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {engineLabel(e)}
            </button>
          ))}
        </div>
      </div>

      {activeServer && !activeServer.available && (
        <p className="shrink-0 border-b border-slate-800 px-3 py-2 text-[11px] text-amber-400">
          {activeServer.name} not installed — see Installs.
        </p>
      )}

      {activeServer && activeServer.available && !serverRunning && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
          <span className="text-[11px] text-amber-300">{activeServer.name} stopped</span>
          <Button
            type="button"
            size="sm"
            className="h-7 bg-teal-600 px-2 text-[11px] hover:bg-teal-500"
            disabled={!isConnected}
            onClick={onToggleServer}
          >
            <Play className="h-3 w-3" />
            Start
          </Button>
        </div>
      )}

      {activeServer && serverRunning && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-1.5">
          <span className="truncate font-mono text-[10px] text-slate-500">{activeServer.conn_str}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-[10px] text-slate-500 hover:text-slate-300"
            disabled={!isConnected}
            onClick={onToggleServer}
          >
            <Square className="mr-1 h-2.5 w-2.5" />
            Stop
          </Button>
        </div>
      )}

      <div className="shrink-0 border-b border-slate-800 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            type="search"
            placeholder="Filter databases & tables…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={dbDisabled}
            className="h-8 border-slate-700 bg-slate-900 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-teal-600"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="h-full min-h-0 flex-1">
        <div className="py-1">
          {dbDisabled ? (
            <p className="px-4 py-8 text-center text-xs text-slate-500">
              Start {activeServer?.name ?? "the server"} to browse databases.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-500">
              {engine === "sqlite"
                ? "No SQLite files found. Park sites and refresh."
                : "No databases found."}
            </p>
          ) : (
            filtered.map((db) => {
              const expanded = expandedDatabase === db.id
              const tables = (tablesByDatabase[dbCacheKey(engine, db.id)] ?? []).filter((t) =>
                filter.trim()
                  ? t.toLowerCase().includes(filter.trim().toLowerCase()) ||
                    db.name.toLowerCase().includes(filter.trim().toLowerCase())
                  : true
              )
              const showTables = expanded || (filter.trim() && tables.length > 0)

              return (
                <div key={db.id} className="select-none">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors",
                      selectedDatabase === db.id && !selectedTable
                        ? "bg-slate-800 text-teal-300"
                        : "text-slate-300 hover:bg-slate-900"
                    )}
                    onClick={() => onExpandDatabase(expanded ? null : db.id)}
                  >
                    {showTables ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                    <Database className="h-3.5 w-3.5 shrink-0 text-teal-500/80" />
                    <span className="min-w-0 flex-1 truncate font-medium">{db.name}</span>
                    {tables.length > 0 && (
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">
                        {tables.length}
                      </span>
                    )}
                  </button>

                  {db.subtitle && expanded && (
                    <p className="truncate px-9 pb-1 text-[10px] text-slate-600">{db.subtitle}</p>
                  )}

                  {showTables && (
                    <ul className="pb-1 pl-4">
                      {tables.length === 0 && expanded && schemaLoading ? (
                        <li className="px-6 py-2 text-[11px] text-slate-500">Loading tables…</li>
                      ) : schemaError && expanded ? (
                        <li className="px-6 py-2 text-[11px] text-amber-400">{schemaError}</li>
                      ) : tables.length === 0 && expanded ? (
                        <li className="px-6 py-2 text-[11px] text-slate-500">No tables</li>
                      ) : (
                        tables.map((table) => {
                          const active =
                            selectedDatabase === db.id && selectedTable === table
                          return (
                            <li key={table}>
                              <button
                                type="button"
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-r-md py-1.5 pl-5 pr-3 text-left text-xs transition-colors",
                                  active
                                    ? "border-l-2 border-teal-400 bg-teal-950/60 text-teal-200"
                                    : "border-l-2 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                                )}
                                onClick={() => onSelectTable(db.id, table)}
                              >
                                <Table2 className="h-3 w-3 shrink-0 opacity-70" />
                                <span className="truncate font-mono">{table}</span>
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {engine === "sqlite" && selectedDatabase && (
        <div className="shrink-0 space-y-1.5 border-t border-slate-800 p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
            disabled={!phpAvailable || !isConnected}
            onClick={() => onMigrate(false)}
          >
            <Terminal className="h-3.5 w-3.5" />
            Run migrate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
            disabled={!phpAvailable || !isConnected}
            onClick={() => onMigrate(true)}
          >
            Fresh migrate
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start text-xs text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            disabled={!isConnected}
            onClick={onOpenFolder}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open folder
          </Button>
          {migratingMessage && (
            <p className="text-[10px] text-teal-400">{migratingMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}
