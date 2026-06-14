import { formatBytes } from "@/shared/store/databases"
import type { SQLiteFile } from "@/shared/store/databases"

export type DbEngine = "mysql" | "postgres" | "sqlite" | "mariadb" | "valkey"

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
    case "mariadb":
      return "MariaDB"
    case "postgres":
      return "PostgreSQL"
    case "valkey":
      return "Valkey"
    case "sqlite":
      return "SQLite"
  }
}
