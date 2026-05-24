import { useEffect, useState } from "react"
import { connectToDaemon } from "./shared/api/ws"
import { Sidebar } from "./widgets/Sidebar"
import { General } from "./pages/General"
import { Sites } from "./pages/Sites"
import { PHP } from "./pages/PHP"
import { Node } from "./pages/Node"
import { Services } from "./pages/Services"
import { Databases } from "./pages/Databases"
import { Queues } from "./pages/Queues"
import { Scheduler } from "./pages/Scheduler"
import { Mail } from "./pages/Mail"
import { Dumps } from "./pages/Dumps"
import { Logs } from "./pages/Logs"
import { About } from "./pages/About"

export function App() {
  const [activeView, setActiveView] = useState("general")

  useEffect(() => {
    connectToDaemon()
  }, [])

  const renderView = () => {
    switch (activeView) {
      case "general": return <General />
      case "sites": return <Sites />
      case "php": return <PHP />
      case "node": return <Node />
      case "services": return <Services />
      case "databases": return <Databases />
      case "queues": return <Queues />
      case "scheduler": return <Scheduler />
      case "mail": return <Mail />
      case "dumps": return <Dumps />
      case "logs": return <Logs />
      case "about": return <About />
      default: return <General />
    }
  }

  return (
    <div className="flex w-full h-screen bg-white dark:bg-zinc-900 overflow-hidden">
      
      {/* Left Sidebar */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      {/* Right Content Pane */}
      <main className="flex-1 h-full p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col overflow-hidden bg-white dark:bg-zinc-950/20 min-w-0">
        {renderView()}
      </main>

    </div>
  )
}

export default App
