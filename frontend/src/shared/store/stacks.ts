import { create } from "zustand";

export interface DiscoveredBinary {
  service: string;
  label: string;
  path: string;
}

export interface InstallScan {
  id?: string;
  type: string;
  name: string;
  root_path: string;
  binaries: DiscoveredBinary[];
  site_roots?: string[];
}

export interface StacksSyncPayload {
  saved: InstallScan[];
  suggested: InstallScan[];
  paths: Record<string, string>;
}

interface StacksState {
  saved: InstallScan[];
  suggested: InstallScan[];
  paths: Record<string, string>;
  lastScan: InstallScan | null;
  setSync: (payload: StacksSyncPayload) => void;
  setLastScan: (scan: InstallScan | null) => void;
}

export const useStacksStore = create<StacksState>((set) => ({
  saved: [],
  suggested: [],
  paths: {},
  lastScan: null,
  setSync: (payload) =>
    set({
      saved: payload.saved ?? [],
      suggested: payload.suggested ?? [],
      paths: payload.paths ?? {},
    }),
  setLastScan: (lastScan) => set({ lastScan }),
}));

export function serviceLabel(service: string): string {
  switch (service) {
    case "mysql":
      return "MySQL";
    case "postgres":
      return "PostgreSQL";
    case "redis":
      return "Redis";
    case "php":
      return "PHP";
    case "node":
      return "Node.js";
    default:
      return service;
  }
}
