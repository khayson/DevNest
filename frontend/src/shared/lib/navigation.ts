export type PageStatus = "live" | "partial" | "mock";

export interface PageMeta {
  status: PageStatus;
  label: string;
  description: string;
}

/** Whether each page is wired to the Go daemon or still a UI preview. */
export const PAGE_META: Record<string, PageMeta> = {
  general: {
    status: "live",
    label: "Live",
    description: "Settings sync with the daemon and persist to ~/.devnest/devnest.json",
  },
  sites: {
    status: "live",
    label: "Live",
    description: "Park folders like htdocs to auto-discover Laravel/Node projects as *.test sites, or add sites manually.",
  },
  installs: {
    status: "live",
    label: "Live",
    description: "Scan XAMPP, Laragon, PostgreSQL, or custom folders to register runtime binaries for all services.",
  },
  php: {
    status: "live",
    label: "Live",
    description: "Discovers PHP on PATH or ~/.devnest/runtimes/php, runs php-cgi, and syncs php.ini settings.",
  },
  node: {
    status: "live",
    label: "Live",
    description: "Discovers Node.js, sets active version, and supervises npm run dev per site with live output.",
  },
  services: {
    status: "partial",
    label: "Partial",
    description: "Mail, dump server, DNS, Caddy, PHP, and database servers are live when binaries are installed.",
  },
  databases: {
    status: "live",
    label: "Live",
    description: "Start/stop MySQL, PostgreSQL, and Redis. Browse and edit tables (Adminer-style), scan SQLite files, and run artisan migrations.",
  },
  queues: {
    status: "live",
    label: "Live",
    description: "Per-site Laravel queue:work supervisors with .env connection detection and global worker defaults.",
  },
  scheduler: {
    status: "live",
    label: "Live",
    description: "Per-site schedule:work daemons and one-off schedule:run from the daemon.",
  },
  mail: {
    status: "live",
    label: "Live",
    description: "Captures real SMTP traffic on port 1025 via the daemon.",
  },
  dumps: {
    status: "live",
    label: "Live",
    description: "Receives real dump() payloads on port 9912 with inbox sync and split-view UI.",
  },
  logs: {
    status: "live",
    label: "Live",
    description: "Tails DevNest, Caddy, and Laravel log files with live WebSocket streaming.",
  },
  about: {
    status: "live",
    label: "Live",
    description: "Daemon version, uptime, paths, endpoints, and service registry from the Go orchestrator.",
  },
  notifications: {
    status: "live",
    label: "Live",
    description: "Full history of daemon events and system notifications.",
  },
};

export function getPageMeta(pageId: string): PageMeta | undefined {
  return PAGE_META[pageId];
}

export const STATUS_STYLES: Record<
  PageStatus,
  { badge: string; dot: string }
> = {
  live: {
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  partial: {
    badge:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  mock: {
    badge:
      "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    dot: "bg-zinc-400",
  },
};
