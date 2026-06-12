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
}

interface SitesState {
  sites: SiteEntry[]
  caddyAvailable: boolean
  setSites: (sites: SiteEntry[], caddyAvailable?: boolean) => void
}

export const useSitesStore = create<SitesState>((set) => ({
  sites: [],
  caddyAvailable: false,
  setSites: (sites, caddyAvailable = false) =>
    set({ sites, caddyAvailable }),
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
}
