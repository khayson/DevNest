import { create } from "zustand"

export interface PHPInstallation {
  version: string
  label: string
  binary: string
  cgi_path: string
  ini_path: string
  installed: boolean
}

export interface PHPDirectives {
  memory_limit: string
  max_execution_time: string
  upload_max_filesize: string
}

export interface PHPExtensionState {
  name: string
  label: string
  enabled: boolean
}

export interface PHPSyncPayload {
  installations: PHPInstallation[]
  active_version?: string
  active_label?: string
  active_path?: string
  ini_path?: string
  directives: PHPDirectives
  extensions?: PHPExtensionState[]
  php_available: boolean
  cgi_port: number
}

interface PHPState {
  sync: PHPSyncPayload | null
  setSync: (payload: PHPSyncPayload) => void
}

const defaultDirectives: PHPDirectives = {
  memory_limit: "128M",
  max_execution_time: "30",
  upload_max_filesize: "2M",
}

export const usePHPStore = create<PHPState>((set) => ({
  sync: null,
  setSync: (payload) =>
    set({
      sync: {
        ...payload,
        directives: { ...defaultDirectives, ...payload.directives },
        installations: payload.installations ?? [],
      },
    }),
}))

export function isPHPActive(inst: PHPInstallation, sync: PHPSyncPayload | null): boolean {
  if (!sync?.active_path) return false
  return inst.binary === sync.active_path || inst.cgi_path === sync.active_path
}

export function formatPHPVersion(inst: PHPInstallation): string {
  return inst.label || `PHP ${inst.version}`
}
