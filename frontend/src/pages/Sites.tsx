import { motion } from "framer-motion"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Search,
  Lock,
  Unlock,
  ExternalLink,
  Plus,
  Trash2,
  Globe,
  AlertCircle,
  Pencil,
  FolderOpen,
  FolderTree,
  RefreshCw,
  Sparkles,
  Server,
  Shield,
  Share2,
} from "lucide-react"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Badge } from "@/shared/ui/badge"
import { CopyButton } from "@/shared/ui/copy-button"
import { Spinner, LoadingBlock, SiteListSkeleton } from "@/shared/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog"
import {
  emptySiteForm,
  formatPHPVersion,
  groupSites,
  siteTypeLabel,
  siteUrl,
  useSitesStore,
  type SiteEntry,
} from "@/shared/store/sites"
import { usePHPStore } from "@/shared/store/php"
import { useTelemetryStore } from "@/shared/store/telemetry"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import {
  addSite,
  openPath,
  removeSite,
  syncSites,
  toggleSiteTls,
  updateSite,
  scanParkedPath,
  addParkedPath,
  removeParkedPath,
  rescanParkedPaths,
  importDiscoveredSites,
  startSiteTunnel,
  stopSiteTunnel,
  exportDevnestYml,
} from "@/shared/api/ws"
import { SiteWizard } from "@/pages/sites/site-wizard"
import { notify } from "@/shared/store/notifications"
import { cn } from "@/shared/lib/utils"

type SiteForm = typeof emptySiteForm

export function Sites() {
  const sites = useSitesStore((s) => s.sites)
  const caddyAvailable = useSitesStore((s) => s.caddyAvailable)
  const parkedPaths = useSitesStore((s) => s.parkedPaths)
  const suggestedParkedPaths = useSitesStore((s) => s.suggestedParkedPaths)
  const lastParkedScan = useSitesStore((s) => s.lastParkedScan)
  const lastParkedScanPath = useSitesStore((s) => s.lastParkedScanPath)
  const loading = useSitesStore((s) => s.loading)
  const scanning = useSitesStore((s) => s.scanning)
  const busy = useSitesStore((s) => s.busy)
  const quickParkingPath = useSitesStore((s) => s.quickParkingPath)
  const phpSync = usePHPStore((s) => s.sync)
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const caddyRunning = useTelemetryStore((s) => s.services["caddy"]?.state === "running")

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [parkDialogOpen, setParkDialogOpen] = useState(false)
  const [parkPath, setParkPath] = useState("")
  const [parkName, setParkName] = useState("")
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<string>>(new Set())
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [form, setForm] = useState<SiteForm>(emptySiteForm)

  const phpOptions = useMemo(() => {
    const installs = phpSync?.installations ?? []
    return installs.map((inst) => ({
      value: inst.version,
      label: inst.label || `PHP ${inst.version}`,
    }))
  }, [phpSync?.installations])

  useEffect(() => {
    if (isConnected) syncSites()
  }, [isConnected])

  useEffect(() => {
    if (lastParkedScanPath === parkPath.trim() && lastParkedScan.length > 0) {
      setSelectedDiscovered(
        new Set(lastParkedScan.filter((s) => !s.already_registered).map((s) => s.domain))
      )
    }
  }, [lastParkedScan, lastParkedScanPath, parkPath])

  const filteredSites = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return sites
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.path.toLowerCase().includes(q) ||
        (s.group ?? "").toLowerCase().includes(q) ||
        (s.aliases ?? []).some((a) => a.toLowerCase().includes(q))
    )
  }, [sites, search])

  const groupedSites = useMemo(() => groupSites(filteredSites), [filteredSites])

  const unparkedSuggestions = suggestedParkedPaths.filter(
    (p) => !parkedPaths.some((pp) => pp.path.toLowerCase() === p.toLowerCase())
  )

  const openAddDialog = () => {
    setEditingDomain(null)
    setForm(emptySiteForm)
    setDialogOpen(true)
  }

  const openParkDialog = (prefillPath?: string) => {
    setParkPath(prefillPath ?? "")
    setParkName("")
    setSelectedDiscovered(new Set())
    useSitesStore.getState().setParkedScan("", [])
    setParkDialogOpen(true)
  }

  const scanPreview = lastParkedScanPath === parkPath.trim() ? lastParkedScan : []
  const scanDone = lastParkedScanPath === parkPath.trim() && !scanning

  const toggleDiscovered = (domain: string) => {
    setSelectedDiscovered((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  const handleScanPark = () => {
    if (!parkPath.trim()) {
      notify.error("Path required", "Enter a folder such as C:\\xampp\\htdocs", "system")
      return
    }
    scanParkedPath(parkPath.trim())
  }

  const handleParkAndImport = (importSelectedOnly: boolean) => {
    const path = parkPath.trim()
    if (!path) return

    if (importSelectedOnly) {
      const toImport = scanPreview.filter(
        (s) => selectedDiscovered.has(s.domain) && !s.already_registered
      )
      if (toImport.length > 0) importDiscoveredSites(toImport)
      addParkedPath({ path, name: parkName.trim(), import_sites: false })
      notify.success(
        toImport.length > 0 ? "Sites imported" : "Folder parked",
        toImport.length > 0
          ? `Added ${toImport.length} site(s) and saved ${path}`
          : `${path} saved for future rescans.`,
        "system"
      )
    } else if (scanPreview.length > 0) {
      const toImport = scanPreview.filter((s) => !s.already_registered)
      if (toImport.length > 0) importDiscoveredSites(toImport)
      addParkedPath({ path, name: parkName.trim(), import_sites: false })
      notify.success(
        "Folder parked",
        toImport.length > 0
          ? `Imported ${toImport.length} site(s) from ${path}`
          : `No new sites — ${path} saved for rescans.`,
        "system"
      )
    } else if (addParkedPath({ path, name: parkName.trim(), import_sites: true })) {
      notify.success("Folder parked", `Scanning ${path} for projects…`, "system")
    }

    setParkDialogOpen(false)
    setParkPath("")
    setParkName("")
  }

  const quickPark = (path: string) => {
    useSitesStore.getState().setQuickParkingPath(path)
    if (addParkedPath({ path, import_sites: true })) {
      notify.success("Folder parked", `Scanning ${path} for Laravel and Node projects…`, "system")
    }
  }

  const openEditDialog = (site: SiteEntry) => {
    setEditingDomain(site.domain)
    setForm({
      name: site.name,
      domain: site.domain,
      path: site.path,
      port: String(site.port),
      tls: site.tls,
      php_version: site.pinned_php_version ?? "",
      group: site.group ?? "",
      aliases: (site.aliases ?? []).join(", "),
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    const port = parseInt(form.port, 10) || 8000
    let domain = form.domain.trim().toLowerCase()
    if (domain && !domain.includes(".")) domain = `${domain}.test`

    if (!form.path.trim() || !domain) {
      notify.error("Missing fields", "Path and domain are required.", "system")
      return
    }

    const aliases = form.aliases
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)

    const payload = {
      name: form.name.trim() || domain.split(".")[0],
      domain,
      path: form.path.trim(),
      port,
      tls: form.tls,
      php_version: form.php_version.trim(),
      group: form.group.trim(),
      aliases,
    }

    const ok = editingDomain ? updateSite(payload) : addSite(payload)
    if (ok) {
      notify.success(
        editingDomain ? "Site updated" : "Site added",
        `${domain} saved and Caddy config updated.`,
        "system"
      )
      setDialogOpen(false)
      setEditingDomain(null)
      setForm(emptySiteForm)
    }
  }

  const handleRemove = (site: SiteEntry) => {
    if (removeSite(site.domain)) {
      notify.info("Site removed", `${site.domain} was removed.`, "system")
    }
  }

  const handleToggleTls = (site: SiteEntry) => {
    if (toggleSiteTls(site.domain)) {
      notify.info(
        site.tls ? "HTTPS disabled" : "HTTPS enabled",
        `${site.domain} TLS updated.`,
        "system"
      )
    }
  }

  const handleOpenFolder = (site: SiteEntry) => {
    if (openPath(site.path)) {
      notify.info("Opening folder", site.path, "system")
    }
  }

  const handleStartTunnel = (site: SiteEntry) => {
    if (startSiteTunnel(site.domain)) {
      notify.info("Starting tunnel…", `Waiting for cloudflared URL for ${site.domain}`, "system")
    }
  }

  const handleStopTunnel = (site: SiteEntry) => {
    stopSiteTunnel(site.domain)
  }

  const handleRescan = () => {
    if (rescanParkedPaths()) {
      notify.info("Rescanning", "Looking for new projects in parked folders…", "system")
    }
  }

  const showInitialLoad = loading && sites.length === 0 && isConnected
  const showDisconnected = !isConnected

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full min-h-0 w-full min-w-0"
    >
      <PageLayout>
        {/* Hero */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Globe className="h-4.5 w-4.5" />
                </span>
                <h2 className="text-lg font-bold tracking-tight text-foreground">Local sites</h2>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Park a folder like{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">htdocs</code> to
                auto-discover Laravel &amp; Node apps as{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">*.test</code>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row shrink-0">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setWizardOpen(true)}
                disabled={!isConnected}
              >
                <Sparkles className="h-4 w-4" />
                New Laravel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => openParkDialog()}
                disabled={!isConnected || busy === "park"}
              >
                {busy === "park" ? (
                  <Spinner size="sm" />
                ) : (
                  <FolderTree className="h-4 w-4" />
                )}
                Park folder
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={openAddDialog}
                disabled={!isConnected || busy === "save"}
              >
                <Plus className="h-4 w-4" />
                Add site
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Globe}
              label="Sites"
              value={loading ? "…" : String(sites.length)}
              hint="Registered projects"
            />
            <StatCard
              icon={FolderTree}
              label="Parked"
              value={String(parkedPaths.length)}
              hint="Scan roots"
            />
            <StatCard
              icon={Shield}
              label="Caddy"
              value={!isConnected ? "—" : caddyRunning ? "Running" : caddyAvailable ? "Stopped" : "Missing"}
              hint={caddyRunning ? "Proxy active" : caddyAvailable ? "Start in Services" : "Install Caddy"}
              variant={caddyRunning ? "success" : caddyAvailable ? "muted" : "warn"}
            />
          </div>
        </div>

        {/* Parked folders */}
        {(parkedPaths.length > 0 || unparkedSuggestions.length > 0) && (
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-foreground">Parked folders</h3>
              {parkedPaths.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto h-8"
                  onClick={handleRescan}
                  disabled={!isConnected || busy === "rescan"}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", busy === "rescan" && "animate-spin")} />
                  {busy === "rescan" ? "Rescanning…" : "Rescan all"}
                </Button>
              )}
            </div>

            {parkedPaths.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {parkedPaths.map((parked) => (
                  <div
                    key={parked.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 min-w-0"
                  >
                    <FolderTree className="h-4 w-4 shrink-0 text-primary/70" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{parked.name || parked.path}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{parked.path}</p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPath(parked.path)}>
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (removeParkedPath(parked.id)) {
                            notify.info("Unparked", parked.path, "system")
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unparkedSuggestions.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Detected on this machine
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {unparkedSuggestions.map((path) => (
                    <Button
                      key={path}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-auto min-h-8 justify-start font-mono text-xs whitespace-normal text-left"
                      onClick={() => quickPark(path)}
                      disabled={quickParkingPath === path}
                    >
                      {quickParkingPath === path ? (
                        <Spinner size="sm" label="Parking…" />
                      ) : (
                        <>Park {path}</>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Alerts */}
        {!caddyAvailable && isConnected && !loading && (
          <AlertBanner
            title="Caddy not installed"
            body={
              <>
                Run <code className="font-mono text-xs">.\scripts\install-caddy.ps1</code> or{" "}
                <code className="font-mono text-xs">winget install CaddyServer.Caddy</code>
              </>
            }
          />
        )}

        {caddyAvailable && !caddyRunning && isConnected && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Server className="h-3.5 w-3.5 shrink-0" />
            Caddy is installed but not running — start it from Services.
          </div>
        )}

        {/* Sites list */}
        <section className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Your sites
              {!loading && sites.length > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">({filteredSites.length})</span>
              )}
            </h3>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter sites…"
                value={search}
                disabled={showInitialLoad}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {showDisconnected && (
            <LoadingBlock label="Connecting to daemon…" />
          )}

          {showInitialLoad && <SiteListSkeleton count={4} />}

          {!showDisconnected && !showInitialLoad && filteredSites.length === 0 && (
            <EmptySites onPark={() => openParkDialog()} onAdd={openAddDialog} isConnected={isConnected} />
          )}

          {!showDisconnected && !showInitialLoad && filteredSites.length > 0 && (
            <div className="space-y-6">
              {[...groupedSites.entries()].map(([groupName, groupList]) => (
                <div key={groupName}>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{groupName}</h3>
                  <div className="grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {groupList.map((site) => (
                      <SiteCard
                        key={site.domain}
                        site={site}
                        onEdit={() => openEditDialog(site)}
                        onRemove={() => handleRemove(site)}
                        onToggleTls={() => handleToggleTls(site)}
                        onOpenFolder={() => handleOpenFolder(site)}
                        onStartTunnel={() => handleStartTunnel(site)}
                        onStopTunnel={() => handleStopTunnel(site)}
                        onExportYml={() => exportDevnestYml(site.domain)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <SiteWizard open={wizardOpen} onOpenChange={setWizardOpen} />

          {busy === "import" && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 py-3 text-sm text-primary">
              <Spinner size="sm" label="Importing sites…" />
            </div>
          )}
        </section>

        {/* Add / edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDomain ? "Edit site" : "Add local site"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <FormField label="Display name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-app" />
              </FormField>
              <FormField label="Domain">
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="my-app.test"
                  disabled={Boolean(editingDomain)}
                />
              </FormField>
              <FormField label="Project path">
                <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="C:/projects/my-app" />
              </FormField>
              <FormField label="Backend port (proxy apps)">
                <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="8000" />
              </FormField>
              <FormField label="PHP version (Laravel)">
                <Select
                  value={form.php_version || "__global__"}
                  onValueChange={(v) => setForm({ ...form, php_version: v === "__global__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use global active PHP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Use global active PHP</SelectItem>
                    {phpOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Group">
                <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Work, Client A…" />
              </FormField>
              <FormField label="Aliases (comma-separated)">
                <Input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="app.test, api.test" />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.tls} onChange={(e) => setForm({ ...form, tls: e.target.checked })} className="rounded border-border" />
                <span>HTTPS with local certificate</span>
              </label>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={busy === "save"} className="w-full sm:w-auto">
                {busy === "save" ? <Spinner size="sm" label="Saving…" /> : "Save site"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Park dialog */}
        <Dialog open={parkDialogOpen} onOpenChange={setParkDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Park a folder</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <FormField label="Projects folder">
                <Input value={parkPath} onChange={(e) => setParkPath(e.target.value)} placeholder="C:/xampp/htdocs" />
              </FormField>
              <FormField label="Label (optional)">
                <Input value={parkName} onChange={(e) => setParkName(e.target.value)} placeholder="XAMPP htdocs" />
              </FormField>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-fit"
                onClick={handleScanPark}
                disabled={!isConnected || scanning}
              >
                <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
                {scanning ? "Scanning folder…" : "Scan for projects"}
              </Button>

              {scanning && (
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 py-8">
                  <LoadingBlock label="Scanning for Laravel & Node projects…" />
                </div>
              )}

              {!scanning && scanPreview.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-border p-2">
                  {scanPreview.map((site) => (
                    <label
                      key={site.domain}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        site.already_registered
                          ? "opacity-50 border-border bg-muted/20 cursor-not-allowed"
                          : selectedDiscovered.has(site.domain)
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:bg-muted/30"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={site.already_registered || selectedDiscovered.has(site.domain)}
                        disabled={site.already_registered}
                        onChange={() => toggleDiscovered(site.domain)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{site.name}</span>
                          <Badge variant="outline" className="text-[10px]">{siteTypeLabel(site.type)}</Badge>
                          {site.already_registered && (
                            <Badge variant="secondary" className="text-[10px]">Already added</Badge>
                          )}
                        </div>
                        <p className="font-mono text-xs text-primary mt-0.5">{site.domain}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {!scanning && scanDone && scanPreview.length === 0 && parkPath.trim() && (
                <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  No Laravel or Node projects found in this folder.
                </p>
              )}
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setParkDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
                {scanPreview.some((s) => !s.already_registered) && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => handleParkAndImport(true)}
                    disabled={selectedDiscovered.size === 0 || busy === "park"}
                  >
                    {busy === "park" ? <Spinner size="sm" /> : "Import selected"}
                  </Button>
                )}
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => handleParkAndImport(false)}
                  disabled={busy === "park"}
                >
                  {busy === "park" ? <Spinner size="sm" label="Working…" /> : "Park & import all"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </motion.div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  variant = "muted",
}: {
  icon: typeof Globe
  label: string
  value: string
  hint: string
  variant?: "success" | "warn" | "muted"
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/60 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          variant === "success" && "text-emerald-600 dark:text-emerald-400",
          variant === "warn" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground truncate">{hint}</p>
    </div>
  )
}

function AlertBanner({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton value="winget install CaddyServer.Caddy" label="Copy winget" variant="button" />
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function EmptySites({
  onPark,
  onAdd,
  isConnected,
}: {
  onPark: () => void
  onAdd: () => void
  isConnected: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <Globe className="h-12 w-12 text-muted-foreground/30" />
      <div>
        <p className="font-semibold text-foreground">No sites yet</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Park your <code className="font-mono text-xs">htdocs</code> folder to import every Laravel project automatically.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onPark} disabled={!isConnected}>
          <FolderTree className="h-4 w-4" />
          Park folder
        </Button>
        <Button type="button" className="w-full sm:w-auto" onClick={onAdd} disabled={!isConnected}>
          <Plus className="h-4 w-4" />
          Add manually
        </Button>
      </div>
    </div>
  )
}

function SiteActions({
  site,
  onEdit,
  onRemove,
  onOpenFolder,
  onStartTunnel,
  onStopTunnel,
  onExportYml,
}: {
  site: SiteEntry
  onEdit: () => void
  onRemove: () => void
  onOpenFolder: () => void
  onStartTunnel: () => void
  onStopTunnel: () => void
  onExportYml?: () => void
}) {
  const url = siteUrl(site)
  const hasTunnel = Boolean(site.tunnel_url)
  return (
    <div className="flex items-center justify-end gap-0.5 flex-wrap">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", hasTunnel && "text-sky-600")}
        onClick={hasTunnel ? onStopTunnel : onStartTunnel}
        title={hasTunnel ? "Stop public tunnel" : "Start public tunnel (cloudflared)"}
      >
        <Share2 className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenFolder} title="Open folder">
        <FolderOpen className="h-3.5 w-3.5" />
      </Button>
      <CopyButton value={site.path} label="path" variant="icon" title="Copy path" />
      <CopyButton value={url} label="url" variant="icon" title="Copy URL" />
      {onExportYml && (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onExportYml} title="Export devnest.yml">
          <Server className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} title="Remove">
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  )
}

function TlsToggle({ site, onToggleTls }: { site: SiteEntry; onToggleTls: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggleTls}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
        site.tls
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
      title={site.tls ? "HTTPS on" : "HTTPS off"}
    >
      {site.tls ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
    </button>
  )
}

function SiteCard({
  site,
  onEdit,
  onRemove,
  onToggleTls,
  onOpenFolder,
  onStartTunnel,
  onStopTunnel,
  onExportYml,
}: {
  site: SiteEntry
  onEdit: () => void
  onRemove: () => void
  onToggleTls: () => void
  onOpenFolder: () => void
  onStartTunnel: () => void
  onStopTunnel: () => void
  onExportYml?: () => void
}) {
  const url = siteUrl(site)
  const isLaravel = site.type === "laravel"

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-border/80 hover:bg-muted/10">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-foreground">{site.name}</h4>
          <p className="truncate font-mono text-xs text-muted-foreground">{site.domain}</p>
          {(site.aliases?.length ?? 0) > 0 && (
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              + {site.aliases!.join(", ")}
            </p>
          )}
          {!site.path_exists && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Path not found on disk</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={isLaravel ? "default" : "secondary"} className="text-[10px]">
            {siteTypeLabel(site.type)}
          </Badge>
          <TlsToggle site={site} onToggleTls={onToggleTls} />
        </div>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <span className="truncate">{url}</span>
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>

      {site.tunnel_url && (
        <a
          href={site.tunnel_url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
        >
          <span className="truncate">{site.tunnel_url}</span>
          <Share2 className="h-3.5 w-3.5 shrink-0" />
        </a>
      )}

      <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground" title={site.path}>
        {site.path}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {isLaravel ? (
          <>
            <span>PHP {formatPHPVersion(site.php_version, site.php_version_pinned)}</span>
            <span className="text-border">·</span>
            <span className="font-mono">CGI :{site.php_cgi_port ?? 9074}</span>
          </>
        ) : (
          <span className="font-mono">Proxy :{site.port}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
        <SiteActions
          site={site}
          onEdit={onEdit}
          onRemove={onRemove}
          onOpenFolder={onOpenFolder}
          onStartTunnel={onStartTunnel}
          onStopTunnel={onStopTunnel}
          onExportYml={onExportYml}
        />
      </div>
    </article>
  )
}
