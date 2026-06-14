import { create } from 'zustand';

export interface ForgeSettings {
  api_token?: string
  server_id?: number
  server_name?: string
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
}

interface ConfigState {
  config: DevNestConfig | null;
  setConfig: (config: DevNestConfig) => void;
  updateSettings: (settings: { launch_on_startup: boolean; auto_start_services: boolean; theme: 'system' | 'light' | 'dark' }) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
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
