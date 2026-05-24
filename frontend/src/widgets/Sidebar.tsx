import { Server, Database, Mail, Terminal, Settings as SettingsIcon, Globe, ShieldCheck, Activity, Sliders, Clock, Info } from "lucide-react"

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const navigation = [
    {
      title: "Environment",
      items: [
        { name: "General", id: "general", icon: SettingsIcon },
        { name: "Sites", id: "sites", icon: Globe },
        { name: "PHP", id: "php", icon: Server },
        { name: "NodeJS", id: "node", icon: Server },
        { name: "Services", id: "services", icon: Activity },
      ]
    },
    {
      title: "Data Services",
      items: [
        { name: "Databases", id: "databases", icon: Database },
      ]
    },
    {
      title: "Background Workers",
      items: [
        { name: "Queue Workers", id: "queues", icon: Sliders },
        { name: "Task Scheduler", id: "scheduler", icon: Clock },
      ]
    },
    {
      title: "Developer Utilities",
      items: [
        { name: "Mail Sandbox", id: "mail", icon: Mail },
        { name: "Dump Console", id: "dumps", icon: Database },
        { name: "Log Streams", id: "logs", icon: Terminal },
      ]
    },
    {
      title: "System",
      items: [
        { name: "About DevNest", id: "about", icon: Info },
      ]
    }
  ]

  return (
    <aside className="w-16 md:w-64 h-full flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800/80 pt-8 pb-6 shrink-0 transition-all duration-200">
      {/* Brand Header */}
      <div className="px-3 md:px-6 mb-6 flex items-center justify-center md:justify-start space-x-0 md:space-x-3 select-none">
        <div className="h-8.5 w-8.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-extrabold shadow-sm shrink-0">
          D
        </div>
        <div className="hidden md:block">
          <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-none">DevNest</div>
          <span className="text-[11px] text-zinc-450 dark:text-zinc-400 font-semibold uppercase tracking-wider mt-1 block">Preferences</span>
        </div>
      </div>
      
      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 md:px-4 space-y-5 custom-scrollbar select-none">
        {navigation.map((category) => (
          <div key={category.title} className="space-y-1.5 animate-fade-in">
            <div className="hidden md:block px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-500">
              {category.title}
            </div>
            <div className="space-y-0.5">
              {category.items.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center justify-center md:justify-start space-x-0 md:space-x-3 px-2 py-2.5 md:px-3.5 md:py-2 rounded-md transition-all duration-150 text-left focus:outline-none
                      ${isActive 
                        ? 'bg-blue-600 text-white shadow-sm font-semibold' 
                        : 'text-zinc-650 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    title={item.name}
                  >
                    <item.icon className={`w-[17px] h-[17px] shrink-0 ${isActive ? 'text-white' : 'text-zinc-450 dark:text-zinc-550'}`} />
                    <span className="hidden md:block text-[13px] leading-none">{item.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pro License Footer Banner */}
      <div className="px-2 md:px-4 mt-6">
        <div className="p-2 md:p-3.5 bg-blue-50/50 dark:bg-blue-950/15 rounded-lg border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-center md:justify-start space-x-0 md:space-x-3 select-none">
          <div className="h-8 w-8 rounded-md bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-none mb-1">DevNest Pro</div>
            <div className="text-[11px] text-zinc-450 dark:text-zinc-400">License Activated</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
