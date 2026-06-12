import { create } from "zustand";

export interface DBServiceInfo {
  id: string;
  name: string;
  version: string;
  port: number;
  username: string;
  password: string;
  conn_str: string;
  available: boolean;
  binary?: string;
}

export interface SQLiteFile {
  site_name: string;
  domain: string;
  db_file: string;
  size_bytes: number;
  path: string;
}

export interface DatabaseSyncPayload {
  services: DBServiceInfo[];
  sqlite_files: SQLiteFile[];
  php_available: boolean;
}

interface DatabasesState {
  services: DBServiceInfo[];
  sqliteFiles: SQLiteFile[];
  phpAvailable: boolean;
  migrationStatus: { domain: string; message: string; success: boolean } | null;
  setSync: (payload: DatabaseSyncPayload) => void;
  setMigrationStatus: (status: DatabasesState["migrationStatus"]) => void;
}

export const useDatabasesStore = create<DatabasesState>((set) => ({
  services: [],
  sqliteFiles: [],
  phpAvailable: false,
  migrationStatus: null,
  setSync: (payload) =>
    set({
      services: payload.services ?? [],
      sqliteFiles: payload.sqlite_files ?? [],
      phpAvailable: Boolean(payload.php_available),
    }),
  setMigrationStatus: (migrationStatus) => set({ migrationStatus }),
}));

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
