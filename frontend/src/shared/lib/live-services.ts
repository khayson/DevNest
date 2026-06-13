import {
  Braces,
  Code2,
  Database,
  Globe,
  HardDrive,
  Mail,
  Search,
  Server,
  Waypoints,
  type LucideIcon,
} from "lucide-react"

export interface ServiceBrandStyle {
  /** Icon + badge colors when service is running */
  active: {
    bg: string
    border: string
    icon: string
    glow?: string
  }
  /** Muted colors when stopped */
  idle: {
    bg: string
    border: string
    icon: string
  }
}

export interface LiveServiceDef {
  id: string
  name: string
  port: string
  version: string
  icon: LucideIcon
  hint: string
  brand: ServiceBrandStyle
}

/** All services registered in the Go daemon — single source of truth for General + Services pages. */
export const LIVE_SERVICES: LiveServiceDef[] = [
  {
    id: "embedded-mail-server",
    name: "Mail Interceptor",
    port: "1025",
    version: "1.0.0",
    icon: Mail,
    hint: "SMTP trap for local apps",
    brand: {
      active: {
        bg: "bg-rose-500/12",
        border: "border-rose-500/30",
        icon: "text-rose-600 dark:text-rose-400",
        glow: "shadow-[0_0_12px_rgba(244,63,94,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "embedded-dump-server",
    name: "Dump Server",
    port: "9912",
    version: "1.0.0",
    icon: Braces,
    hint: "Receives dump() / dd() output",
    brand: {
      active: {
        bg: "bg-amber-500/12",
        border: "border-amber-500/30",
        icon: "text-amber-600 dark:text-amber-400",
        glow: "shadow-[0_0_12px_rgba(245,158,11,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "dns",
    name: "Local DNS Resolver",
    port: "53",
    version: "1.0",
    icon: Globe,
    hint: "Resolves *.test domains to 127.0.0.1",
    brand: {
      active: {
        bg: "bg-sky-500/12",
        border: "border-sky-500/30",
        icon: "text-sky-600 dark:text-sky-400",
        glow: "shadow-[0_0_12px_rgba(14,165,233,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "caddy",
    name: "Caddy Reverse Proxy",
    port: "80, 443",
    version: "2.8.x",
    icon: Waypoints,
    hint: "Reverse proxy for *.test sites",
    brand: {
      active: {
        bg: "bg-violet-500/12",
        border: "border-violet-500/30",
        icon: "text-violet-600 dark:text-violet-400",
        glow: "shadow-[0_0_12px_rgba(139,92,246,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "php",
    name: "PHP CGI",
    port: "9074",
    version: "8.x",
    icon: Code2,
    hint: "FastCGI for Laravel sites via Caddy",
    brand: {
      active: {
        bg: "bg-indigo-500/12",
        border: "border-indigo-500/30",
        icon: "text-indigo-600 dark:text-indigo-400",
        glow: "shadow-[0_0_12px_rgba(99,102,241,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "mysql",
    name: "MySQL",
    port: "3306",
    version: "8.x",
    icon: Database,
    hint: "Managed mysqld when binary is installed",
    brand: {
      active: {
        bg: "bg-orange-500/12",
        border: "border-orange-500/30",
        icon: "text-orange-600 dark:text-orange-400",
        glow: "shadow-[0_0_12px_rgba(249,115,22,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    port: "5432",
    version: "17.x",
    icon: Server,
    hint: "Managed postgres when binary is installed",
    brand: {
      active: {
        bg: "bg-blue-500/12",
        border: "border-blue-500/30",
        icon: "text-blue-600 dark:text-blue-400",
        glow: "shadow-[0_0_12px_rgba(59,130,246,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "redis",
    name: "Redis",
    port: "6379",
    version: "7.x",
    icon: HardDrive,
    hint: "In-memory cache and queues",
    brand: {
      active: {
        bg: "bg-red-500/12",
        border: "border-red-500/30",
        icon: "text-red-600 dark:text-red-400",
        glow: "shadow-[0_0_12px_rgba(239,68,68,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "minio",
    name: "MinIO",
    port: "9000, 9001",
    version: "S3",
    icon: Server,
    hint: "Local S3-compatible object storage",
    brand: {
      active: {
        bg: "bg-pink-500/12",
        border: "border-pink-500/30",
        icon: "text-pink-600 dark:text-pink-400",
        glow: "shadow-[0_0_12px_rgba(236,72,153,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
  {
    id: "meilisearch",
    name: "Meilisearch",
    port: "7700",
    version: "1.7",
    icon: Search,
    hint: "Full-text search engine for local dev",
    brand: {
      active: {
        bg: "bg-teal-500/12",
        border: "border-teal-500/30",
        icon: "text-teal-600 dark:text-teal-400",
        glow: "shadow-[0_0_12px_rgba(20,184,166,0.25)]",
      },
      idle: {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        border: "border-zinc-200/80 dark:border-zinc-700/60",
        icon: "text-zinc-400 dark:text-zinc-500",
      },
    },
  },
]

export const LIVE_SERVICE_IDS = LIVE_SERVICES.map((s) => s.id)

export function countRunningServices(
  services: Record<string, { state?: string } | undefined>
): number {
  return LIVE_SERVICES.filter((s) => services[s.id]?.state === "running").length
}

export function getServiceBrandStyle(service: LiveServiceDef, isRunning: boolean) {
  return isRunning ? service.brand.active : service.brand.idle
}

export const CONFIG_PATH = "~/.devnest/devnest.json"
export const WS_ENDPOINT = "ws://127.0.0.1:9090/ws"
export const DEV_SCRIPT = ".\\scripts\\dev.ps1"
