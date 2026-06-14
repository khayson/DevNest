import { ChevronLeft, Database, PanelLeft, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { engineLabel, sqliteExplorerDatabases, type DbEngine } from "@/shared/lib/databases-ui"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { useDatabasesStore, type TableSelection } from "@/shared/store/databases"
import { sendCommand, openPath, syncDatabases, fetchDBSchema, openDatabase } from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"
import { DbTableReader, type DbContentTab } from "@/pages/databases/db-table-reader"
import { DbSchemaTree } from "@/pages/databases/db-schema-tree"
import { DbConnectionBar } from "@/pages/databases/db-connection-bar"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { PageLayout } from "@/shared/ui/page-layout"

function normalizeDbKey(engine: DbEngine, databaseId: string) {
  const id = databaseId.trim()
  return engine === "sqlite" ? id.replace(/\\/g, "/") : id
}

export function Databases() {
  const rawServices = useTelemetryStore((s) => s.services) || {}
  const isConnected = useTelemetryStore((s) => s.isConnected)

  const dbServices = useDatabasesStore((s) => s.services)
  const sqliteFiles = useDatabasesStore((s) => s.sqliteFiles)
  const phpAvailable = useDatabasesStore((s) => s.phpAvailable)
  const migrationStatus = useDatabasesStore((s) => s.migrationStatus)
  const schema = useDatabasesStore((s) => s.schema)
  const schemaLoading = useDatabasesStore((s) => s.schemaLoading)

  const [engine, setEngine] = useState<DbEngine>("sqlite")
  const [expandedDatabase, setExpandedDatabase] = useState<string | null>(null)
  const [selectedDatabase, setSelectedDatabase] = useState("")
  const [selectedTable, setSelectedTable] = useState("")
  const [activeTab, setActiveTab] = useState<DbContentTab>("select")
  const [migratingDomain, setMigratingDomain] = useState<string | null>(null)
  const [mysqlDatabases, setMysqlDatabases] = useState<string[]>([])
  const [postgresDatabases, setPostgresDatabases] = useState<string[]>([])
  const [tablesCache, setTablesCache] = useState<Record<string, string[]>>({})
  const [mobilePane, setMobilePane] = useState<"tree" | "data">("tree")

  const mysql = dbServices.find((d) => d.id === "mysql")
  const mariadb = dbServices.find((d) => d.id === "mariadb")
  const postgres = dbServices.find((d) => d.id === "postgres")
  const valkey = dbServices.find((d) => d.id === "valkey")
  const mysqlRunning = rawServices["mysql"]?.state === "running"
  const mariadbRunning = rawServices["mariadb"]?.state === "running"
  const postgresRunning = rawServices["postgres"]?.state === "running"
  const valkeyRunning = rawServices["valkey"]?.state === "running"

  const sqliteDbs = useMemo(() => sqliteExplorerDatabases(sqliteFiles), [sqliteFiles])
  const serverDbNames = engine === "mysql" ? mysqlDatabases : postgresDatabases
  const databases =
    engine === "sqlite" ? sqliteDbs : serverDbNames.map((n) => ({ id: n, name: n }))

  const selection: TableSelection | null = useMemo(() => {
    if (!selectedDatabase || !selectedTable) return null
    if (engine === "mariadb" || engine === "valkey") return null
    return {
      engine: engine as "mysql" | "postgres" | "sqlite",
      database: selectedDatabase,
      sqlite_path: engine === "sqlite" ? selectedDatabase : undefined,
      table: selectedTable,
    }
  }, [engine, selectedDatabase, selectedTable])

  const selectedSqlite = sqliteFiles.find((f) => f.path === selectedDatabase)
  const activeServer =
    engine === "mysql"
      ? mysql
      : engine === "mariadb"
        ? mariadb
        : engine === "postgres"
          ? postgres
          : engine === "valkey"
            ? valkey
            : null
  const serverRunning =
    engine === "mysql"
      ? mysqlRunning
      : engine === "mariadb"
        ? mariadbRunning
        : engine === "postgres"
          ? postgresRunning
          : engine === "valkey"
            ? valkeyRunning
            : false

  const selectedDbLabel = useMemo(() => {
    const db = databases.find((d) => d.id === selectedDatabase)
    return db?.name ?? selectedDatabase
  }, [databases, selectedDatabase])

  useEffect(() => {
    if (isConnected) syncDatabases()
  }, [isConnected])

  useEffect(() => {
    if (!schema || schema.error) return
    if (schema.engine === "mysql" && !schema.database) {
      setMysqlDatabases(schema.databases?.map((d) => d.name) ?? [])
    }
    if (schema.engine === "postgres" && !schema.database) {
      setPostgresDatabases(schema.databases?.map((d) => d.name) ?? [])
    }
  }, [schema])

  useEffect(() => {
    if (!schema || schema.error || !schema.database) return
    if (schema.engine !== engine) return
    const tables = schema.databases?.[0]?.tables?.map((t) => t.name) ?? []
    const key = normalizeDbKey(schema.engine as DbEngine, schema.database)
    setTablesCache((prev) => ({ ...prev, [key]: tables }))
  }, [schema, engine])

  useEffect(() => {
    if (!isConnected || engine !== "mysql") return
    if (mysqlRunning && mysql?.available) fetchDBSchema({ engine: "mysql", database: "" })
  }, [isConnected, mysqlRunning, mysql?.available, engine])

  useEffect(() => {
    if (!isConnected || engine !== "postgres") return
    if (postgresRunning && postgres?.available) fetchDBSchema({ engine: "postgres", database: "" })
  }, [isConnected, postgresRunning, postgres?.available, engine])

  useEffect(() => {
    setExpandedDatabase(null)
    setSelectedDatabase("")
    setSelectedTable("")
    setTablesCache({})
    useDatabasesStore.getState().setSelectedTable(null)
    useDatabasesStore.getState().setSchema(null)
  }, [engine])

  useEffect(() => {
    if (!expandedDatabase) return
    if (engine === "sqlite") {
      fetchDBSchema({ engine: "sqlite", sqlite_path: expandedDatabase })
    } else {
      fetchDBSchema({ engine, database: expandedDatabase })
    }
  }, [expandedDatabase, engine])

  useEffect(() => {
    if (selection) useDatabasesStore.getState().setSelectedTable(selection)
  }, [selection])

  useEffect(() => {
    if (migrationStatus && migrationStatus.domain === migratingDomain) {
      const t = setTimeout(() => {
        setMigratingDomain(null)
        useDatabasesStore.getState().setMigrationStatus(null)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [migrationStatus, migratingDomain])

  const refresh = () => {
    syncDatabases()
    if (mysqlRunning) fetchDBSchema({ engine: "mysql", database: "" })
    if (postgresRunning) fetchDBSchema({ engine: "postgres", database: "" })
    if (expandedDatabase) {
      if (engine === "sqlite") fetchDBSchema({ engine: "sqlite", sqlite_path: expandedDatabase })
      else fetchDBSchema({ engine, database: expandedDatabase })
    }
  }

  const handleEngineChange = (next: DbEngine) => setEngine(next)

  const handleExpandDatabase = (id: string | null) => {
    setExpandedDatabase(id)
    if (id) setSelectedDatabase(id)
  }

  const handleSelectTable = (databaseId: string, table: string) => {
    setSelectedDatabase(databaseId)
    setSelectedTable(table)
    setActiveTab("select")
    setMobilePane("data")
  }

  const handleExitTable = useCallback(() => {
    setSelectedTable("")
    useDatabasesStore.getState().setSelectedTable(null)
    useDatabasesStore.getState().clearTableBrowser()
    setMobilePane("tree")
  }, [])

  useEffect(() => {
    if (!selection) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleExitTable()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selection, handleExitTable])

  const runMigration = (fresh: boolean) => {
    if (!selectedSqlite || !phpAvailable) {
      notify.warning("PHP required", "Install PHP to run migrations.", "system")
      return
    }
    setMigratingDomain(selectedSqlite.domain)
    sendCommand("run_migration", { domain: selectedSqlite.domain, fresh })
  }

  const toggleServer = () => {
    sendCommand(rawServices[engine]?.state === "running" ? "stop_service" : "start_service", {
      serviceId: engine === "mariadb" ? "mariadb" : engine === "valkey" ? "valkey" : engine,
    })
  }

  const migratingMessage =
    migratingDomain && migrationStatus?.domain === migratingDomain ? migrationStatus.message : null

  return (
    <PageLayout noScroll className="p-0">
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      <DbConnectionBar
        engine={engine}
        activeServer={activeServer}
        serverRunning={engine === "sqlite" ? true : serverRunning}
        isConnected={isConnected}
        sqlitePath={engine === "sqlite" ? selectedDatabase || undefined : undefined}
        onToggleServer={toggleServer}
        onOpenTablePlus={() => {
          if (engine === "sqlite" && selectedDatabase) {
            openDatabase("sqlite", selectedDatabase)
          } else {
            openDatabase(engine)
          }
        }}
      />
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Schema tree — dark sidebar */}
      <aside
        className={cn(
          "flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-slate-800 md:w-72 lg:w-80",
          mobilePane === "data" ? "hidden md:flex" : "flex"
        )}
      >
        <DbSchemaTree
          engine={engine}
          onEngineChange={handleEngineChange}
          databases={databases}
          tablesByDatabase={tablesCache}
          expandedDatabase={expandedDatabase}
          onExpandDatabase={handleExpandDatabase}
          selectedDatabase={selectedDatabase}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          schemaLoading={schemaLoading}
          schemaError={
            schema?.engine === engine &&
            expandedDatabase &&
            normalizeDbKey(engine, schema.database ?? "") === normalizeDbKey(engine, expandedDatabase)
              ? schema.error
              : undefined
          }
          isConnected={isConnected}
          onRefresh={refresh}
          activeServer={activeServer}
          serverRunning={serverRunning}
          onToggleServer={toggleServer}
          phpAvailable={phpAvailable}
          onMigrate={runMigration}
          onOpenFolder={() =>
            selectedSqlite && openPath(selectedSqlite.path.replace(/\\[^\\]+$/, ""))
          }
          migratingMessage={migratingMessage}
          mobile
          onCloseMobile={() => setMobilePane("data")}
        />
      </aside>

      {/* Main workspace */}
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          mobilePane === "tree" ? "hidden md:flex" : "flex"
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-teal-900/30 bg-gradient-to-r from-teal-700 to-teal-600 px-3 py-2.5 text-white sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white/90 hover:bg-white/10 md:hidden"
            onClick={() => (selection ? handleExitTable() : setMobilePane("tree"))}
            title={selection ? "Close table" : "Show schema tree"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 shrink-0 text-white/90 hover:bg-white/10 md:inline-flex"
            onClick={() => setMobilePane("tree")}
            title="Show schema tree"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            {selection ? (
              <p className="truncate text-sm font-medium">
                <span className="text-teal-100">{engineLabel(engine)}</span>
                <span className="mx-1.5 text-teal-200/60">›</span>
                <span>{selectedDbLabel}</span>
                <span className="mx-1.5 text-teal-200/60">›</span>
                <span className="font-mono">{selectedTable}</span>
              </p>
            ) : (
              <p className="text-sm font-medium text-teal-50">Pick a table from the schema tree</p>
            )}
          </div>
          {selection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-2 text-white/90 hover:bg-white/10 hover:text-white"
              onClick={handleExitTable}
              title="Close table (Esc)"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Close</span>
            </Button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
          {selection ? (
            <DbTableReader
              selection={selection}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClose={handleExitTable}
            />
          ) : (
            <ScrollArea className="h-full min-h-0 flex-1">
              <div className="flex min-h-[min(100%,20rem)] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
                <Database className="h-7 w-7" />
              </div>
              <div className="max-w-md space-y-2">
                <p className="text-base font-semibold text-foreground">Database browser</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  TablePlus-style layout: pick MySQL, PostgreSQL, or SQLite in the sidebar, browse tables here,
                  or click <strong>Open in TablePlus</strong> in the connection bar for the native app.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setMobilePane("tree")}
              >
                <PanelLeft className="h-4 w-4" />
                Open schema tree
              </Button>
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
    </div>
    </PageLayout>
  )
}
