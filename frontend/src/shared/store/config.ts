import { create } from 'zustand';

export interface ForgeSettings {
  api_token?: string
  server_id?: number
  server_name?: string
}

export interface ForgeSite {
  id: number
  name: string
  directory: string
}

export interface DevNestConfig {
  active_php_version: string;
  registered_sites: Record<string, string>;
  custom_ports: Record<string, number>;
  launch_on_startup: boolean;
  auto_start_services: boolean;
  theme: 'system' | 'light' | 'dark';
  forge?: ForgeSettings;
  ide_command?: string;
  dns_use_hosts_fallback?: boolean;
  first_run_completed?: boolean;
}

interface ConfigState {
  config: DevNestConfig | null;
  forgeSites: ForgeSite[];
  setConfig: (config: DevNestConfig) => void;
  setForgeSites: (sites: ForgeSite[]) => void;
  updateSettings: (settings: { launch_on_startup: boolean; auto_start_services: boolean; theme: 'system' | 'light' | 'dark' }) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  forgeSites: [],
  setConfig: (config) => set({ config }),
  setForgeSites: (forgeSites) => set({ forgeSites }),
  updateSettings: (settings) => set((state) => {
    if (!state.config) return {};
    return {
      config: {
        ...state.config,
        ...settings,
      }
    };
  }),
}));
