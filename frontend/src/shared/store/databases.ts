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
  external?: boolean;
  running_note?: string;
}

export interface SchemaTable {
  name: string;
}

export interface SchemaDatabase {
  name: string;
  tables?: SchemaTable[];
}

export interface SchemaResult {
  engine: string;
  database?: string;
  databases: SchemaDatabase[];
  error?: string;
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

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
  default?: string;
}

export interface TableSelection {
  engine: "mysql" | "postgres" | "sqlite";
  database: string;
  sqlite_path?: string;
  table: string;
}

export interface TableStructureResult {
  engine: string;
  database: string;
  table: string;
  columns: ColumnInfo[];
  error?: string;
}

export interface TableDataResult {
  engine: string;
  database: string;
  table: string;
  columns: string[];
  rows: string[][];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

export interface QueryResult {
  engine: string;
  database: string;
  columns?: string[];
  rows?: string[][];
  affected?: number;
  message?: string;
  error?: string;
}

export interface RowMutationResult {
  engine: string;
  database: string;
  table: string;
  affected: number;
  message?: string;
  error?: string;
}

interface DatabasesState {
  services: DBServiceInfo[];
  sqliteFiles: SQLiteFile[];
  phpAvailable: boolean;
  migrationStatus: { domain: string; message: string; success: boolean } | null;
  schema: SchemaResult | null;
  schemaLoading: boolean;
  selectedTable: TableSelection | null;
  tableStructure: TableStructureResult | null;
  tableData: TableDataResult | null;
  tableStructureLoading: boolean;
  tableDataLoading: boolean;
  queryResult: QueryResult | null;
  queryLoading: boolean;
  mutationLoading: boolean;
  setSync: (payload: DatabaseSyncPayload) => void;
  setMigrationStatus: (status: DatabasesState["migrationStatus"]) => void;
  setSchema: (schema: SchemaResult | null) => void;
  setSchemaLoading: (loading: boolean) => void;
  setSelectedTable: (table: TableSelection | null) => void;
  setTableStructure: (structure: TableStructureResult | null) => void;
  setTableData: (data: TableDataResult | null) => void;
  setTableStructureLoading: (loading: boolean) => void;
  setTableDataLoading: (loading: boolean) => void;
  setQueryResult: (result: QueryResult | null) => void;
  setQueryLoading: (loading: boolean) => void;
  setMutationLoading: (loading: boolean) => void;
  clearTableBrowser: () => void;
}

export const useDatabasesStore = create<DatabasesState>((set) => ({
  services: [],
  sqliteFiles: [],
  phpAvailable: false,
  migrationStatus: null,
  schema: null,
  schemaLoading: false,
  selectedTable: null,
  tableStructure: null,
  tableData: null,
  tableStructureLoading: false,
  tableDataLoading: false,
  queryResult: null,
  queryLoading: false,
  mutationLoading: false,
  setSync: (payload) =>
    set({
      services: payload.services ?? [],
      sqliteFiles: payload.sqlite_files ?? [],
      phpAvailable: Boolean(payload.php_available),
    }),
  setMigrationStatus: (migrationStatus) => set({ migrationStatus }),
  setSchema: (schema) => set({ schema, schemaLoading: false }),
  setSchemaLoading: (schemaLoading) => set({ schemaLoading }),
  setSelectedTable: (selectedTable) => set({ selectedTable }),
  setTableStructure: (tableStructure) => set({ tableStructure, tableStructureLoading: false }),
  setTableData: (tableData) => set({ tableData, tableDataLoading: false }),
  setTableStructureLoading: (tableStructureLoading) => set({ tableStructureLoading }),
  setTableDataLoading: (tableDataLoading) => set({ tableDataLoading }),
  setQueryResult: (queryResult) => set({ queryResult, queryLoading: false }),
  setQueryLoading: (queryLoading) => set({ queryLoading }),
  setMutationLoading: (mutationLoading) => set({ mutationLoading }),
  clearTableBrowser: () =>
    set({
      selectedTable: null,
      tableStructure: null,
      tableData: null,
      queryResult: null,
      tableStructureLoading: false,
      tableDataLoading: false,
      queryLoading: false,
      mutationLoading: false,
    }),
}));

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function tableTargetPayload(selection: TableSelection) {
  return {
    engine: selection.engine,
    database: selection.engine === "sqlite" ? selection.sqlite_path ?? selection.database : selection.database,
    sqlite_path: selection.sqlite_path,
    table: selection.table,
  };
}
