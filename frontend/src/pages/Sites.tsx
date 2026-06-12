import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
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
} from "lucide-react"
import { PageLayout } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Badge } from "@/shared/ui/badge"
import { CopyButton } from "@/shared/ui/copy-button"
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
  siteTypeLabel,
  siteUrl,
  useSitesStore,
  type SiteEntry,
} from "@/shared/store/sites"
import { usePHPStore } from "@/shared/store/php"
import { useTelemetryStore } from "@/shared/store/telemetry"
import {
  addSite,
  openPath,
  removeSite,
  syncSites,
  toggleSiteTls,
  updateSite,
} from "@/shared/api/ws"
import { notify } from "@/shared/store/notifications"
import { cn } from "@/shared/lib/utils"

type SiteForm = typeof emptySiteForm

export function Sites() {
  const sites = useSitesStore((s) => s.sites)
  const caddyAvailable = useSitesStore((s) => s.caddyAvailable)
  const phpSync = usePHPStore((s) => s.sync)
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const caddyRunning = useTelemetryStore((s) => s.services["caddy"]?.state === "running")

  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
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

  const filteredSites = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return sites
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.path.toLowerCase().includes(q)
    )
  }, [sites, search])

  const openAddDialog = () => {
    setEditingDomain(null)
    setForm(emptySiteForm)
    setDialogOpen(true)
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
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    const port = parseInt(form.port, 10) || 8000
    let domain = form.domain.trim().toLowerCase()
    if (domain && !domain.includes(".")) {
      domain = `${domain}.test`
    }

    if (!form.path.trim() || !domain) {
      notify.error("Missing fields", "Path and domain are required.", "system")
      return
    }

    const payload = {
      name: form.name.trim() || domain.split(".")[0],
      domain,
      path: form.path.trim(),
      port,
      tls: form.tls,
      php_version: form.php_version.trim(),
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="h-full min-h-0 w-full"
    >
      <PageLayout>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Local <code className="rounded bg-muted px-1 font-mono text-xs">*.test</code> sites
              proxied through Caddy. Laravel projects auto-detect{" "}
              <code className="font-mono text-xs">public/index.php</code>.
            </p>
          </div>
          <Button type="button" size="sm" onClick={openAddDialog} disabled={!isConnected}>
            <Plus className="h-4 w-4" />
            Add site
          </Button>
        </div>

        {!caddyAvailable && isConnected && (
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-foreground">Caddy not installed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Run <code className="font-mono">.\scripts\install-caddy.ps1</code> from the project root,
                or install with{" "}
                <code className="font-mono">winget install CaddyServer.Caddy</code>.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton
                  value="winget install CaddyServer.Caddy"
                  label="Copy winget command"
                  variant="button"
                />
                <CopyButton
                  value=".\\scripts\\install-caddy.ps1"
                  label="Copy install script"
                  variant="button"
                />
              </div>
            </div>
          </div>
        )}

        {caddyAvailable && !caddyRunning && isConnected && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            Caddy is installed but not running — start it from the Services page.
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter sites…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {filteredSites.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Globe className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium text-foreground">No sites yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a project folder — DevNest detects Laravel or proxies to your dev server port.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openAddDialog} disabled={!isConnected}>
                <Plus className="h-4 w-4" />
                Add your first site
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">PHP</th>
                    <th className="px-4 py-3 text-center">Backend</th>
                    <th className="px-4 py-3 text-center">TLS</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSites.map((site) => (
                    <SiteRow
                      key={site.domain}
                      site={site}
                      onEdit={() => openEditDialog(site)}
                      onRemove={() => handleRemove(site)}
                      onToggleTls={() => handleToggleTls(site)}
                      onOpenFolder={() => handleOpenFolder(site)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDomain ? "Edit site" : "Add local site"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Display name</span>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="my-app"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Domain</span>
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="my-app.test"
                  disabled={Boolean(editingDomain)}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Project path</span>
                <Input
                  value={form.path}
                  onChange={(e) => setForm({ ...form, path: e.target.value })}
                  placeholder="C:/Users/you/projects/my-app"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Backend port (proxy apps only)</span>
                <Input
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  placeholder="8000"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">PHP version (Laravel)</span>
                <select
                  value={form.php_version}
                  onChange={(e) => setForm({ ...form, php_version: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Use global active PHP</option>
                  {phpOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.tls}
                  onChange={(e) => setForm({ ...form, tls: e.target.checked })}
                  className="rounded border-border"
                />
                <span>HTTPS with local certificate (recommended)</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                Save site
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </motion.div>
  )
}

function SiteRow({
  site,
  onEdit,
  onRemove,
  onToggleTls,
  onOpenFolder,
}: {
  site: SiteEntry
  onEdit: () => void
  onRemove: () => void
  onToggleTls: () => void
  onOpenFolder: () => void
}) {
  const url = siteUrl(site)
  const isLaravel = site.type === "laravel"

  return (
    <tr className="transition-colors hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{site.name}</div>
        {!site.path_exists && (
          <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Path not found</div>
        )}
        <div
          className="mt-0.5 max-w-[180px] truncate font-mono text-xs text-muted-foreground"
          title={site.path}
        >
          {site.path}
        </div>
      </td>
      <td className="px-4 py-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {url}
          <ExternalLink className="h-3 w-3" />
        </a>
      </td>
      <td className="px-4 py-3">
        <Badge variant={isLaravel ? "default" : "secondary"}>{siteTypeLabel(site.type)}</Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {isLaravel ? formatPHPVersion(site.php_version, site.php_version_pinned) : "—"}
      </td>
      <td className="px-4 py-3 text-center">
        {isLaravel ? (
          <Badge variant="outline" className="font-mono tabular-nums">
            :{site.php_cgi_port ?? 9074}
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-mono tabular-nums">
            :{site.port}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={onToggleTls}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            site.tls
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
          title={site.tls ? "HTTPS enabled — click to disable" : "HTTP only — click to enable HTTPS"}
        >
          {site.tls ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit site">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenFolder}
            title="Open project folder"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
          <CopyButton value={site.path} label="path" variant="icon" title="Copy path" />
          <CopyButton value={url} label="url" variant="icon" title="Copy URL" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} title="Remove site">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
