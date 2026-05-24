import { motion } from "framer-motion"
import { Search, Lock, Unlock, Folder, ExternalLink, Shield, Plus } from "lucide-react"
import { useState } from "react"

interface Site {
  name: string
  path: string
  url: string
  phpVersion: string
  secured: boolean
}

export function Sites() {
  const [search, setSearch] = useState("")
  const [sites, setSites] = useState<Site[]>([
    { name: "devnest-app", path: "C:/Users/VICTUS/Desktop/DevNest", url: "http://devnest-app.test", phpVersion: "8.3", secured: true },
    { name: "laravel-blog", path: "C:/Users/VICTUS/Desktop/laravel-blog", url: "http://laravel-blog.test", phpVersion: "8.2", secured: false },
    { name: "my-portfolio", path: "C:/Users/VICTUS/Desktop/my-portfolio", url: "http://my-portfolio.test", phpVersion: "8.3", secured: true },
  ])

  const toggleSecured = (name: string) => {
    setSites(sites.map(s => s.name === name ? { ...s, secured: !s.secured, url: s.secured ? s.url.replace("https://", "http://") : s.url.replace("http://", "https://") } : s))
  }

  const filteredSites = sites.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="space-y-6 h-full flex flex-col min-h-0"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Sites</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage your local sites and configure virtual hosts.</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow flex items-center space-x-2 transition-colors">
          <Plus className="w-4.5 h-4.5" />
          <span>Add Site</span>
        </button>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter sites by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Sites List/Table */}
      <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 shadow-sm min-h-0 custom-scrollbar">
        <table className="w-full border-collapse text-left text-sm text-zinc-500 dark:text-zinc-400">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-4">Name</th>
              <th scope="col" className="px-6 py-4">URL</th>
              <th scope="col" className="px-6 py-4">Path</th>
              <th scope="col" className="px-6 py-4 text-center">PHP</th>
              <th scope="col" className="px-6 py-4 text-center">SSL</th>
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                  No sites matched your search.
                </td>
              </tr>
            ) : (
              filteredSites.map((site) => (
                <tr key={site.name} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors group">
                  <td className="px-6 py-5 font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                    {site.name}
                  </td>
                  <td className="px-6 py-5">
                    <a 
                      href={site.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-1.5 font-semibold text-sm"
                    >
                      <span>{site.url}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                  <td className="px-6 py-5 text-xs font-mono text-zinc-500 max-w-[240px] truncate" title={site.path}>
                    {site.path}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 px-2.5 py-1 rounded text-xs font-semibold">
                      {site.phpVersion}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button 
                      onClick={() => toggleSecured(site.name)}
                      className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center border transition-all
                        ${site.secured 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800 text-green-600 dark:text-green-400 shadow-sm" 
                          : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 text-zinc-400"
                        }`}
                      title={site.secured ? "Secured with SSL" : "Unsecured http site"}
                    >
                      {site.secured ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end space-x-2.5">
                      <button 
                        className="p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        title="Open Site Directory"
                      >
                        <Folder className="w-4.5 h-4.5" />
                      </button>
                      <button 
                        className="p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        title="Configure SSL Certificate"
                      >
                        <Shield className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
