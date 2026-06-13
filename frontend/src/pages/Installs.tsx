import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  FolderOpen,
  Plus,
  Trash2,
  Search,
  HardDrive,
  Sparkles,
  Check,
  RefreshCw,
} from "lucide-react"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Badge } from "@/shared/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { useTelemetryStore } from "@/shared/store/telemetry"
import {
  useStacksStore,
  serviceLabel,
  type InstallScan,
} from "@/shared/store/stacks"
import { addStack, openPath, removeStack, scanStack, syncStacks } from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"

function StackCard({
  stack,
  saved,
  onAdd,
  onRemove,
}: {
  stack: InstallScan
  saved?: boolean
  onAdd?: () => void
  onRemove?: () => void
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 shrink-0 text-blue-500" />
            <h3 className="truncate font-bold text-zinc-900 dark:text-zinc-100">{stack.name}</h3>
            <Badge variant="outline" className="text-[10px] uppercase">
              {stack.type}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-zinc-500" title={stack.root_path}>
            {stack.root_path}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => openPath(stack.root_path)}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            title="Open folder"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          {saved ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-2 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              title="Remove saved install"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <Button size="sm" onClick={onAdd}>
              Add
            </Button>
          )}
        </div>
      </div>

      {stack.binaries.length > 0 && (
        <div className="mt-4 space-y-2">
          {stack.binaries.map((bin) => (
            <div
              key={`${stack.root_path}-${bin.service}`}
              className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/60"
            >
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {bin.label || serviceLabel(bin.service)}
              </span>
              <span className="truncate font-mono text-zinc-500" title={bin.path}>
                {bin.path}
              </span>
            </div>
          ))}
        </div>
      )}

      {stack.site_roots && stack.site_roots.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          Site roots: {stack.site_roots.join(", ")}
        </p>
      )}
    </div>
  )
}

export function Installs() {
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const saved = useStacksStore((s) => s.saved)
  const suggested = useStacksStore((s) => s.suggested)
  const paths = useStacksStore((s) => s.paths)
  const lastScan = useStacksStore((s) => s.lastScan)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [rootPath, setRootPath] = useState("")
  const [stackName, setStackName] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (isConnected) syncStacks()
  }, [isConnected])

  const filteredSaved = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return saved
    return saved.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.root_path.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
    )
  }, [saved, search])

  const handleScanPreview = () => {
    if (!rootPath.trim()) {
      notify.error("Path required", "Enter the install folder to scan.", "system")
      return
    }
    scanStack(rootPath.trim())
  }

  const handleAdd = (stack?: InstallScan) => {
    const path = stack?.root_path ?? rootPath.trim()
    if (!path) return
    if (
      addStack({
        root_path: path,
        name: stack?.name ?? stackName.trim(),
      })
    ) {
      notify.success("Install added", "Runtime paths updated for discovered services.", "system")
      setDialogOpen(false)
      setRootPath("")
      setStackName("")
      useStacksStore.getState().setLastScan(null)
    }
  }

  const preview = lastScan?.root_path === rootPath.trim() ? lastScan : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="h-full min-h-0 w-full"
    >
      <PageLayout>
      <div className="space-y-8">
        <p className="text-sm text-muted-foreground">
          Point DevNest at XAMPP, Laragon, PostgreSQL, or any folder with runtimes. Discovered binaries
          populate MySQL, PostgreSQL, Redis, PHP, and Node across the app.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved installs…"
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add install folder
          </Button>
        </div>

        {Object.keys(paths).length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Active runtime paths
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(paths).map(([service, path]) => (
                <Badge key={service} variant="secondary" className="font-mono text-[11px]">
                  {serviceLabel(service)}: {path}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {suggested.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                Detected on this machine
              </h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {suggested.map((stack) => (
                <StackCard
                  key={stack.root_path}
                  stack={stack}
                  onAdd={() => handleAdd(stack)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Saved installs</h2>
          {filteredSaved.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              No saved installs yet. Add a folder like <code className="font-mono">C:/xampp</code> or{" "}
              <code className="font-mono">C:/Program Files/PostgreSQL/17</code>.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredSaved.map((stack) => (
                <StackCard
                  key={stack.root_path}
                  stack={stack}
                  saved
                  onRemove={() => {
                    if (removeStack({ id: stack.id, root_path: stack.root_path })) {
                      notify.info("Install removed", `${stack.name} removed from saved list.`, "system")
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add install folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">Folder path</label>
              <Input
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="C:/xampp or C:/Program Files/PostgreSQL/17"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500">
                Display name (optional)
              </label>
              <Input
                value={stackName}
                onChange={(e) => setStackName(e.target.value)}
                placeholder="My XAMPP"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleScanPreview} disabled={!isConnected}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Scan folder
            </Button>

            {preview && (
              <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {preview.name} ({preview.type})
                </p>
                {preview.binaries.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-600">No supported binaries found in this folder.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {preview.binaries.map((b) => (
                      <li key={b.service} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {b.label}: <span className="font-mono">{b.path}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAdd(preview ?? undefined)} disabled={!rootPath.trim()}>
              Save install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageLayout>
    </motion.div>
  )
}
