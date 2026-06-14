import { create } from "zustand"

export type SiteType = "laravel" | "proxy"

export interface SiteEntry {
  name: string
  domain: string
  path: string
  port: number
  tls: boolean
  pinned_php_version?: string
  php_version?: string
  type?: SiteType
  path_exists?: boolean
  php_version_pinned?: boolean
  php_cgi_port?: number
  tunnel_url?: string
  aliases?: string[]
  group?: string
}

export interface ParkedPath {
  id: string
  name?: string
  path: string
}

export interface DiscoveredSite {
  name: string
  domain: string
  path: string
  port: number
  type: SiteType
  already_registered: boolean
}

interface SitesState {
  sites: SiteEntry[]
  caddyAvailable: boolean
  parkedPaths: ParkedPath[]
  suggestedParkedPaths: string[]
  lastParkedScan: DiscoveredSite[]
  lastParkedScanPath: string
  loading: boolean
  scanning: boolean
  busy: "rescan" | "import" | "park" | "save" | null
  quickParkingPath: string | null
  setSites: (sites: SiteEntry[], caddyAvailable?: boolean, parkedPaths?: ParkedPath[], suggested?: string[]) => void
  setParkedScan: (path: string, sites: DiscoveredSite[]) => void
  setLoading: (loading: boolean) => void
  setScanning: (scanning: boolean) => void
  setBusy: (busy: SitesState["busy"]) => void
  setQuickParkingPath: (path: string | null) => void
}

export const useSitesStore = create<SitesState>((set) => ({
  sites: [],
  caddyAvailable: false,
  parkedPaths: [],
  suggestedParkedPaths: [],
  lastParkedScan: [],
  lastParkedScanPath: "",
  loading: false,
  scanning: false,
  busy: null,
  quickParkingPath: null,
  setSites: (sites, caddyAvailable = false, parkedPaths = [], suggestedParkedPaths = []) =>
    set({ sites, caddyAvailable, parkedPaths, suggestedParkedPaths, loading: false, busy: null, quickParkingPath: null }),
  setParkedScan: (lastParkedScanPath, lastParkedScan) =>
    set({ lastParkedScanPath, lastParkedScan, scanning: false }),
  setLoading: (loading) => set({ loading }),
  setScanning: (scanning) => set({ scanning }),
  setBusy: (busy) => set({ busy }),
  setQuickParkingPath: (quickParkingPath) => set({ quickParkingPath }),
}))

export function siteUrl(site: SiteEntry): string {
  const scheme = site.tls ? "https" : "http"
  return `${scheme}://${site.domain}`
}

export function siteTypeLabel(type?: SiteType): string {
  if (type === "laravel") return "Laravel"
  return "Proxy"
}

export function formatPHPVersion(version?: string, pinned?: boolean): string {
  if (!version) return "—"
  const short = version.replace(/(\d+\.\d+)\.0+$/, "$1")
  return pinned ? short : `${short} (global)`
}

export const emptySiteForm = {
  name: "",
  domain: "",
  path: "",
  port: "8000",
  tls: true,
  php_version: "",
  group: "",
  aliases: "",
}

export function groupSites(sites: SiteEntry[]): Map<string, SiteEntry[]> {
  const map = new Map<string, SiteEntry[]>()
  for (const site of sites) {
    const key = site.group?.trim() || "Ungrouped"
    const list = map.get(key) ?? []
    list.push(site)
    map.set(key, list)
  }
  return map
}
