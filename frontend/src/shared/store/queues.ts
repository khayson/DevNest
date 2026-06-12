import { create } from "zustand";

export interface QueueWorkerRow {
  domain: string;
  site_name: string;
  connection: string;
  queues: string;
  service_id: string;
  supports_worker: boolean;
  log_path: string;
}

export interface QueueDefaults {
  tries: number;
  timeout: number;
  memory: number;
  queues: string;
}

export interface QueueSyncPayload {
  workers: QueueWorkerRow[];
  defaults: QueueDefaults;
  php_available: boolean;
}

interface QueuesState {
  workers: QueueWorkerRow[];
  defaults: QueueDefaults;
  phpAvailable: boolean;
  setSync: (payload: QueueSyncPayload) => void;
}

const DEFAULTS: QueueDefaults = {
  tries: 3,
  timeout: 60,
  memory: 128,
  queues: "default",
};

export const useQueuesStore = create<QueuesState>((set) => ({
  workers: [],
  defaults: DEFAULTS,
  phpAvailable: false,
  setSync: (payload) =>
    set({
      workers: payload.workers ?? [],
      defaults: payload.defaults ?? DEFAULTS,
      phpAvailable: Boolean(payload.php_available),
    }),
}));
