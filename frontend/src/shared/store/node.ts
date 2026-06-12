import { create } from "zustand";

export interface NodeInstallation {
  version: string;
  label: string;
  binary: string;
  npm_binary: string;
  installed: boolean;
}

export interface NodeDevServer {
  domain: string;
  site_name: string;
  port: number;
  service_id: string;
  dev_command: string;
  uses_vite: boolean;
}

export interface NodeSyncPayload {
  installations: NodeInstallation[];
  node_available: boolean;
  active_version?: string;
  active_label?: string;
  active_path?: string;
  npm_path?: string;
  servers: NodeDevServer[];
}

interface NodeState {
  sync: NodeSyncPayload | null;
  setSync: (payload: NodeSyncPayload) => void;
}

export const useNodeStore = create<NodeState>((set) => ({
  sync: null,
  setSync: (sync) => set({ sync }),
}));

export function isNodeActive(inst: NodeInstallation, sync: NodeSyncPayload | null): boolean {
  if (!sync?.active_path) return false;
  return inst.binary === sync.active_path;
}
