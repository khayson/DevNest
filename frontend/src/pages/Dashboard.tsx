import { useTelemetryStore } from "../shared/store/telemetry"
import { Play, Square as Stop, RefreshCw, Server, Settings, Globe, Database, Mail } from "lucide-react"
import { sendCommand } from "../shared/api/ws"

const getServiceIcon = (id: string) => {
  switch (id) {
    case 'caddy': return <Globe className="w-5 h-5 text-blue-500" />
    case 'php': return <Server className="w-5 h-5 text-indigo-500" />
    case 'mysql': return <Database className="w-5 h-5 text-orange-500" />
    case 'postgres': return <Database className="w-5 h-5 text-blue-400" />
    case 'redis': return <Database className="w-5 h-5 text-red-500" />
    case 'mailhog': return <Mail className="w-5 h-5 text-green-500" />
    default: return <Settings className="w-5 h-5 text-gray-500" />
  }
}

export function Dashboard() {
  const rawServices = useTelemetryStore((state) => state.services) || {}

  const expectedServices = [
    { id: "caddy", name: "Caddy Web Server", version: "v2.8.4", port: "80, 443" },
    { id: "php", name: "PHP-FPM", version: "8.3.0", port: "9000" },
    { id: "mysql", name: "MySQL Server", version: "8.0", port: "3306" },
    { id: "postgres", name: "PostgreSQL", version: "16", port: "5432" },
    { id: "redis", name: "Redis", version: "7.2", port: "6379" },
    { id: "mailhog", name: "MailHog", version: "1.0.1", port: "1025, 8025" },
    { id: "dns", name: "Local DNS Resolver", version: "1.0", port: "53" },
  ]

  const services = expectedServices.map(s => {
    const metric = rawServices[s.id]
    const isRunning = metric !== undefined && (metric.MemoryBytes > 0 || metric.CpuPercent > 0)
    return { ...s, isRunning }
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your local development services.</p>
        </div>
        
        {/* Master Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => sendCommand("start_all")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" /> Start All
          </button>
          <button 
            onClick={() => sendCommand("stop_all")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md border border-border hover:bg-secondary/80 transition-colors shadow-sm"
          >
            <Stop className="w-4 h-4" /> Stop All
          </button>
        </div>
      </div>

      {/* Services List */}
      <div className="border border-border rounded-lg bg-card overflow-hidden shadow-sm">
        <div className="divide-y divide-border">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-muted rounded-md border border-border/50">
                  {getServiceIcon(service.id)}
                </div>
                <div>
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    {service.name}
                    <span className="text-xs text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                      {service.version}
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${service.isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-400'}`} />
                      {service.isRunning ? 'Running' : 'Stopped'}
                    </div>
                    <span>•</span>
                    <span className="font-mono">Port {service.port}</span>
                  </div>
                </div>
              </div>

              {/* Individual Action Buttons (Herd Style) */}
              <div className="flex items-center gap-2">
                <button 
                  className={`p-2 rounded-md transition-colors ${service.isRunning ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-950' : 'text-muted-foreground hover:bg-muted'}`}
                  title="Start Service"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button 
                  className="p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  title="Restart Service"
                  disabled={!service.isRunning}
                >
                  <RefreshCw className={`w-4 h-4 ${!service.isRunning ? 'opacity-50' : ''}`} />
                </button>
                <button 
                  className="p-2 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  title="Stop Service"
                  disabled={!service.isRunning}
                >
                  <Stop className={`w-4 h-4 ${!service.isRunning ? 'opacity-50' : ''}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
