import {
  ChevronLeft,
  ChevronRight,
  Code2,
  FileText,
  ListTree,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchDBTableData, fetchDBTableStructure, mutateDBRow, runDBQuery } from "@/shared/api/ws"
import { cn } from "@/shared/lib/utils"
import {
  useDatabasesStore,
  tableTargetPayload,
  type ColumnInfo,
  type TableSelection,
} from "@/shared/store/databases"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Spinner } from "@/shared/ui/spinner"
import {
  ResponsiveTable,
  ResponsiveTableBody,
  ResponsiveTableHead,
} from "@/shared/ui/responsive-table"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"

const PAGE_SIZE = 50

export type DbContentTab = "select" | "structure" | "sql"

interface DbTableReaderProps {
  selection: TableSelection | null
  activeTab: DbContentTab
  onTabChange: (tab: DbContentTab) => void
  onClose?: () => void
}

export function DbTableReader({
  selection,
  activeTab,
  onTabChange,
  onClose,
}: DbTableReaderProps) {
  const structure = useDatabasesStore((s) => s.tableStructure)
  const data = useDatabasesStore((s) => s.tableData)
  const queryResult = useDatabasesStore((s) => s.queryResult)
  const structureLoading = useDatabasesStore((s) => s.tableStructureLoading)
  const dataLoading = useDatabasesStore((s) => s.tableDataLoading)
  const queryLoading = useDatabasesStore((s) => s.queryLoading)
  const mutationLoading = useDatabasesStore((s) => s.mutationLoading)

  const [page, setPage] = useState(0)
  const [sql, setSql] = useState("")
  const [editMode, setEditMode] = useState<"insert" | "update" | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editKeys, setEditKeys] = useState<Record<string, string>>({})

  const target = useMemo(
    () => (selection ? tableTargetPayload(selection) : null),
    [selection]
  )
  const offset = page * PAGE_SIZE

  const loadStructure = useCallback(() => {
    if (!selection || !target) return
    fetchDBTableStructure({ ...target, table: selection.table })
  }, [target, selection])

  const loadData = useCallback(() => {
    if (!selection || !target) return
    fetchDBTableData({
      ...target,
      table: selection.table,
      limit: PAGE_SIZE,
      offset,
    })
  }, [target, selection, offset])

  useEffect(() => {
    if (!selection || !target) return
    setPage(0)
    const quoted =
      selection.engine === "mysql"
        ? `\`${selection.table}\``
        : `"${selection.table}"`
    setSql(`SELECT * FROM ${quoted} LIMIT 50`)
    loadStructure()
    fetchDBTableData({ ...target, table: selection.table, limit: PAGE_SIZE, offset: 0 })
  }, [selection?.engine, selection?.database, selection?.sqlite_path, selection?.table])

  useEffect(() => {
    if (page > 0) loadData()
  }, [page, loadData])

  if (!selection) return null

  const columns = structure?.columns ?? []
  const pkColumns = columns.filter((c) => c.primary)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  const openInsert = () => {
    const vals: Record<string, string> = {}
    for (const col of columns) {
      vals[col.name] = col.default && col.default !== "NULL" ? col.default : ""
    }
    setEditValues(vals)
    setEditKeys({})
    setEditMode("insert")
  }

  const openEdit = (row: string[]) => {
    if (!data) return
    const vals: Record<string, string> = {}
    const keys: Record<string, string> = {}
    data.columns.forEach((col, i) => {
      vals[col] = row[i] ?? ""
    })
    const keyCols = pkColumns.length > 0 ? pkColumns.map((c) => c.name) : data.columns
    for (const col of keyCols) {
      keys[col] = vals[col] ?? ""
    }
    setEditValues(vals)
    setEditKeys(keys)
    setEditMode("update")
  }

  const handleDelete = (row: string[]) => {
    if (!data || !target || !window.confirm("Delete this row?")) return
    const keys: Record<string, string> = {}
    const keyCols = pkColumns.length > 0 ? pkColumns.map((c) => c.name) : data.columns
    data.columns.forEach((col, i) => {
      if (keyCols.includes(col)) keys[col] = row[i] ?? ""
    })
    mutateDBRow({ ...target, table: selection.table, operation: "delete", keys })
    setTimeout(loadData, 300)
  }

  const handleSaveRow = () => {
    if (!editMode || !target) return
    const payload =
      editMode === "insert"
        ? { values: editValues }
        : { values: editValues, keys: editKeys }
    mutateDBRow({ ...target, table: selection.table, operation: editMode, ...payload })
    setEditMode(null)
    setTimeout(() => {
      loadData()
      loadStructure()
    }, 300)
  }

  const runSql = () => {
    if (!target) return
    runDBQuery({ ...target, sql })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800 sm:px-4">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">{selection.table}</p>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.total} rows · {columns.length} columns
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 md:hidden"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
              Close
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              loadStructure()
              loadData()
            }}
            disabled={structureLoading || dataLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (structureLoading || dataLoading) && "animate-spin")} />
          </Button>
          {activeTab === "select" && (
            <Button type="button" size="sm" className="h-8" onClick={openInsert} disabled={columns.length === 0}>
              <Plus className="h-3.5 w-3.5" />
              Insert row
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as DbContentTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 overflow-x-auto border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
          <TabsList className="h-9 w-max min-w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0 px-1 sm:px-0">
            <TabsTrigger
              value="select"
              className="h-9 shrink-0 rounded-none border-b-2 border-transparent px-3 text-xs sm:px-4 data-[state=active]:border-teal-600 data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-400"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              <span className="sm:hidden">Data</span>
              <span className="hidden sm:inline">Browse data</span>
            </TabsTrigger>
            <TabsTrigger
              value="structure"
              className="h-9 shrink-0 rounded-none border-b-2 border-transparent px-3 text-xs sm:px-4 data-[state=active]:border-teal-600 data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-400"
            >
              <ListTree className="mr-1.5 h-3.5 w-3.5" />
              Structure
            </TabsTrigger>
            <TabsTrigger
              value="sql"
              className="h-9 shrink-0 rounded-none border-b-2 border-transparent px-3 text-xs sm:px-4 data-[state=active]:border-teal-600 data-[state=active]:bg-transparent data-[state=active]:text-teal-700 data-[state=active]:shadow-none dark:data-[state=active]:text-teal-400"
            >
              <Code2 className="mr-1.5 h-3.5 w-3.5" />
              <span className="sm:hidden">SQL</span>
              <span className="hidden sm:inline">SQL command</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          {activeTab === "select" && (
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              {dataLoading && !data?.rows?.length ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner size="sm" label="Loading rows…" />
                </div>
              ) : data?.error ? (
                <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-destructive">
                  {data.error}
                </p>
              ) : !data?.columns?.length ? (
                <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  No rows in this table.
                </p>
              ) : (
                <>
                  <ResponsiveTable
                    fill
                    minWidth={Math.max(640, data.columns.length * 120)}
                    className="mx-3 mt-3 min-h-0 flex-1 border-0 shadow-none sm:mx-4 sm:mt-4 [&_thead]:bg-teal-50 [&_thead_th]:text-teal-900 dark:[&_thead]:bg-teal-950/40 dark:[&_thead_th]:text-teal-200 [&_tbody_tr:nth-child(even)]:bg-slate-50/80 dark:[&_tbody_tr:nth-child(even)]:bg-slate-900/40"
                  >
                    <ResponsiveTableHead>
                      <tr>
                        {data.columns.map((col) => (
                          <th key={col} className="whitespace-nowrap px-4 py-2.5">{col}</th>
                        ))}
                        <th className="w-24 px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </ResponsiveTableHead>
                    <ResponsiveTableBody>
                      {data.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-muted/30">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="max-w-[16rem] truncate px-4 py-2 font-mono text-xs" title={cell}>
                              {isNullCell(cell) ? (
                                <span className="italic text-muted-foreground/60">NULL</span>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(row)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(row)}
                                disabled={mutationLoading}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </ResponsiveTableBody>
                  </ResponsiveTable>
                  <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <span>
                      Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0 || dataLoading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span>Page {page + 1} / {totalPages}</span>
                      <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page + 1 >= totalPages || dataLoading} onClick={() => setPage((p) => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "structure" && (
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              {structureLoading && !structure?.columns?.length ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner size="sm" label="Loading structure…" />
                </div>
              ) : structure?.error ? (
                <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-destructive">
                  {structure.error}
                </p>
              ) : (
                <ResponsiveTable fill minWidth={560} className="m-3 min-h-0 flex-1 sm:m-4">
                  <ResponsiveTableHead>
                    <tr>
                      <th className="px-4 py-2.5">Column</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Null</th>
                      <th className="px-4 py-2.5">Key</th>
                      <th className="px-4 py-2.5">Default</th>
                    </tr>
                  </ResponsiveTableHead>
                  <ResponsiveTableBody>
                    {(structure?.columns ?? []).map((col) => (
                      <tr key={col.name}>
                        <td className="px-4 py-2 font-mono text-xs font-semibold">{col.name}</td>
                        <td className="px-4 py-2 font-mono text-xs">{col.type}</td>
                        <td className="px-4 py-2 text-xs">{col.nullable ? "YES" : "NO"}</td>
                        <td className="px-4 py-2 text-xs">{col.primary ? "PRI" : ""}</td>
                        <td className="max-w-[12rem] truncate px-4 py-2 font-mono text-xs">{col.default || "—"}</td>
                      </tr>
                    ))}
                  </ResponsiveTableBody>
                </ResponsiveTable>
              )}
            </div>
          )}

          {activeTab === "sql" && (
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              <div className="shrink-0 space-y-3 border-b border-border p-3 sm:p-4">
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" className="h-8" onClick={runSql} disabled={queryLoading || !sql.trim()}>
                    {queryLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    Execute
                  </Button>
                  {queryResult?.message && !queryResult.error && (
                    <span className="text-xs text-muted-foreground">{queryResult.message}</span>
                  )}
                </div>
                {queryResult?.error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{queryResult.error}</p>
                )}
              </div>
              {queryResult?.columns?.length ? (
                <ResponsiveTable
                  fill
                  minWidth={Math.max(480, queryResult.columns.length * 100)}
                  className="mx-3 mb-3 min-h-0 flex-1 sm:mx-4 sm:mb-4"
                >
                  <ResponsiveTableHead>
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-4 py-2.5">{col}</th>
                      ))}
                    </tr>
                  </ResponsiveTableHead>
                  <ResponsiveTableBody>
                    {(queryResult.rows ?? []).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="max-w-[14rem] truncate px-4 py-2 font-mono text-xs">
                            {cell || <span className="italic text-muted-foreground/60">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </ResponsiveTableBody>
                </ResponsiveTable>
              ) : (
                <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  Run a query to see results here.
                </div>
              )}
            </div>
          )}
        </div>
      </Tabs>

      <RowEditDialog
        open={editMode !== null}
        mode={editMode ?? "insert"}
        columns={columns}
        values={editValues}
        keyColumns={Object.keys(editKeys)}
        loading={mutationLoading}
        onChange={setEditValues}
        onClose={() => setEditMode(null)}
        onSave={handleSaveRow}
      />
    </div>
  )
}

function RowEditDialog({
  open,
  mode,
  columns,
  values,
  keyColumns,
  loading,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean
  mode: "insert" | "update"
  columns: ColumnInfo[]
  values: Record<string, string>
  keyColumns: string[]
  loading: boolean
  onChange: (values: Record<string, string>) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "insert" ? "Insert row" : "Edit row"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {columns.map((col) => {
            const isKey = mode === "update" && keyColumns.includes(col.name)
            return (
              <label key={col.name} className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {col.name}
                  {col.primary && " (PK)"}
                </span>
                <Input
                  value={values[col.name] ?? ""}
                  disabled={isKey}
                  placeholder={col.nullable ? "NULL if empty" : ""}
                  className="font-mono text-xs"
                  onChange={(e) => onChange({ ...values, [col.name]: e.target.value })}
                />
                <span className="text-[10px] text-muted-foreground">{col.type}</span>
              </label>
            )
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={onSave} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isNullCell(value: string) {
  return value === "" || value === "NULL" || value === "\\N"
}
