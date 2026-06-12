import { create } from "zustand";

export interface SchedulerRow {
  domain: string;
  site_name: string;
  command: string;
  frequency: string;
  service_id: string;
  log_path: string;
}

export interface SchedulerSyncPayload {
  schedulers: SchedulerRow[];
  php_available: boolean;
}

interface SchedulerState {
  schedulers: SchedulerRow[];
  phpAvailable: boolean;
  lastAction: { domain: string; success: boolean; message: string } | null;
  setSync: (payload: SchedulerSyncPayload) => void;
  setLastAction: (action: SchedulerState["lastAction"]) => void;
}

export const useSchedulerStore = create<SchedulerState>((set) => ({
  schedulers: [],
  phpAvailable: false,
  lastAction: null,
  setSync: (payload) =>
    set({
      schedulers: payload.schedulers ?? [],
      phpAvailable: Boolean(payload.php_available),
    }),
  setLastAction: (lastAction) => set({ lastAction }),
}));
