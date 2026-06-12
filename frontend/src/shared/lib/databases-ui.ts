import { formatBytes } from "@/shared/store/databases"
import type { SQLiteFile } from "@/shared/store/databases"

export type DbEngine = "mysql" | "postgres" | "sqlite"

export interface ExplorerDatabase {
  id: string
  name: string
  subtitle?: string
}

export function sqliteExplorerDatabases(files: SQLiteFile[]): ExplorerDatabase[] {
  return files.map((f) => ({
    id: f.path,
    name: f.site_name,
    subtitle: `${f.db_file} · ${formatBytes(f.size_bytes)}`,
  }))
}

export function engineLabel(engine: DbEngine) {
  switch (engine) {
    case "mysql":
      return "MySQL"
    case "postgres":
      return "PostgreSQL"
    case "sqlite":
      return "SQLite"
  }
}
