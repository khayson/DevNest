import { create } from "zustand";

export interface AboutPath {
  label: string;
  path: string;
  note: string;
}

export interface AboutEndpoint {
  label: string;
  address: string;
  note: string;
}

export interface AboutService {
  id: string;
  name: string;
  state: string;
  port?: string;
  available: boolean;
}

export interface AboutCapabilities {
  caddy: boolean;
  php: boolean;
  mysql: boolean;
  postgres: boolean;
  redis: boolean;
}

export interface AboutSyncPayload {
  daemon_version: string;
  go_version: string;
  os: string;
  arch: string;
  started_at: string;
  uptime_seconds: number;
  config_path: string;
  devnest_dir: string;
  logs_dir: string;
  caddy_dir: string;
  site_count: number;
  running_services: number;
  registered_services: number;
  auto_start_services: boolean;
  launch_on_startup: boolean;
  active_php_version?: string;
  php_installations: number;
  capabilities: AboutCapabilities;
  paths: AboutPath[];
  endpoints: AboutEndpoint[];
  services: AboutService[];
}

interface AboutState {
  about: AboutSyncPayload | null;
  setSync: (payload: AboutSyncPayload) => void;
}

export const useAboutStore = create<AboutState>((set) => ({
  about: null,
  setSync: (about) => set({ about }),
}));

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function computeLiveUptime(startedAt: string): number {
  if (!startedAt) return 0;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, (Date.now() - start) / 1000);
}
