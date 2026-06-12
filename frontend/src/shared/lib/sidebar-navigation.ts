import type { LucideIcon } from "lucide-react"
import {
  Server,
  Database,
  Mail,
  Terminal,
  Settings as SettingsIcon,
  Globe,
  Activity,
  Sliders,
  Clock,
  Info,
  Braces,
  Bell,
} from "lucide-react"

export interface SidebarNavItem {
  name: string
  id: string
  icon: LucideIcon
  /** Short label for collapsed tooltips */
  shortName?: string
}

export interface SidebarNavSection {
  title: string
  items: SidebarNavItem[]
}

export const SIDEBAR_NAVIGATION: SidebarNavSection[] = [
  {
    title: "General",
    items: [
      { name: "General", id: "general", icon: SettingsIcon, shortName: "General" },
      { name: "Sites", id: "sites", icon: Globe, shortName: "Sites" },
      { name: "PHP", id: "php", icon: Server, shortName: "PHP" },
      { name: "Node.js", id: "node", icon: Server, shortName: "Node" },
      { name: "Services", id: "services", icon: Activity, shortName: "Services" },
    ],
  },
  {
    title: "Services",
    items: [{ name: "Databases", id: "databases", icon: Database, shortName: "DB" }],
  },
  {
    title: "Workers",
    items: [
      { name: "Queue Workers", id: "queues", icon: Sliders, shortName: "Queues" },
      { name: "Task Scheduler", id: "scheduler", icon: Clock, shortName: "Scheduler" },
    ],
  },
  {
    title: "Debugging",
    items: [
      { name: "Mail", id: "mail", icon: Mail, shortName: "Mail" },
      { name: "Dumps", id: "dumps", icon: Braces, shortName: "Dumps" },
      { name: "Logs", id: "logs", icon: Terminal, shortName: "Logs" },
    ],
  },
  {
    title: "System",
    items: [
      { name: "Notifications", id: "notifications", icon: Bell, shortName: "Alerts" },
      { name: "About", id: "about", icon: Info, shortName: "About" },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  general: "General",
  sites: "Sites",
  php: "PHP",
  node: "Node.js",
  services: "Services",
  databases: "Databases",
  queues: "Queue Workers",
  scheduler: "Task Scheduler",
  mail: "Mail",
  dumps: "Dumps",
  logs: "Logs",
  notifications: "Notifications",
  about: "About DevNest",
}

export function getPageTitle(pageId: string): string {
  return PAGE_TITLES[pageId] ?? "DevNest"
}

export function findNavItem(pageId: string): SidebarNavItem | undefined {
  for (const section of SIDEBAR_NAVIGATION) {
    const item = section.items.find((i) => i.id === pageId)
    if (item) return item
  }
  return undefined
}
