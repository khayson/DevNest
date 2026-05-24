import { motion } from "framer-motion"
import { Mail as MailIcon, Trash2, Search, ArrowRight, Eye, Calendar, User } from "lucide-react"
import { useCapturedStore } from "../shared/store/captured"
import { useState } from "react"

export function Mail() {
  const emails = useCapturedStore((state) => state.emails)
  const clearEmails = useCapturedStore((state) => state.clearEmails)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"html" | "text" | "headers">("html")
  const [search, setSearch] = useState("")

  const selectedEmail = emails.find((e) => e.id === selectedId) || null

  const filteredEmails = emails.filter(
    (e) =>
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.sender.toLowerCase().includes(search.toLowerCase()) ||
      e.recipient.toLowerCase().includes(search.toLowerCase())
  )

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Mail</h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">Intercept, debug, and preview emails sent by your local apps on port 1025.</p>
        </div>

        {emails.length > 0 && (
          <button 
            onClick={() => {
              clearEmails()
              setSelectedId(null)
            }}
            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-md shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Inbox</span>
          </button>
        )}
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {emails.length === 0 ? (
        <div className="flex-1 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500 space-y-3">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full">
            <MailIcon className="w-6 h-6 text-zinc-400 dark:text-zinc-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mailbox is empty</p>
            <p className="text-xs">SMTP server is listening on port <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">1025</span></p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/50 shadow-sm min-h-0">
          
          {/* Left Column: Email List */}
          <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 custom-scrollbar">
              {filteredEmails.map((email) => {
                const isSelected = email.id === selectedId
                return (
                  <button
                    key={email.id}
                    onClick={() => setSelectedId(email.id)}
                    className={`w-full p-3 text-left transition-colors flex flex-col space-y-1
                      ${isSelected 
                        ? "bg-blue-50/70 dark:bg-blue-950/20 text-zinc-900 dark:text-zinc-50 border-l-2 border-blue-500" 
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/10 text-zinc-700 dark:text-zinc-350"
                      }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[120px]" title={email.sender}>
                        {email.sender.split("@")[0]}
                      </span>
                      <span>{formatTimestamp(email.timestamp)}</span>
                    </div>
                    <span className="text-xs font-semibold truncate leading-tight">
                      {email.subject || "(No Subject)"}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate">
                      To: {email.recipient}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: Reader Pane */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950/40">
            {selectedEmail ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Email Info Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 bg-zinc-50/30 dark:bg-zinc-900/10">
                  <div className="flex items-start justify-between">
                    <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                      {selectedEmail.subject || "(No Subject)"}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center space-x-2">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-350">From:</span>
                      <span className="font-mono select-all bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded text-[11px]">{selectedEmail.sender}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-350">To:</span>
                      <span className="font-mono select-all bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded text-[11px]">{selectedEmail.recipient}</span>
                    </div>
                    <div className="flex items-center space-x-2 md:col-span-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-350">Date:</span>
                      <span>{new Date(selectedEmail.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 space-x-2 text-xs">
                  <button
                    onClick={() => setActiveTab("html")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors
                      ${activeTab === "html" 
                        ? "bg-zinc-100 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200" 
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                  >
                    HTML Preview
                  </button>
                  <button
                    onClick={() => setActiveTab("text")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors
                      ${activeTab === "text" 
                        ? "bg-zinc-100 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200" 
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                  >
                    Plain Text
                  </button>
                  <button
                    onClick={() => setActiveTab("headers")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors
                      ${activeTab === "headers" 
                        ? "bg-zinc-100 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200" 
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                  >
                    Raw Content
                  </button>
                </div>

                {/* Mail Content Reader View */}
                <div className="flex-1 overflow-auto p-4 min-h-0 bg-white dark:bg-zinc-950/20">
                  {activeTab === "html" ? (
                    selectedEmail.html ? (
                      <iframe 
                        title="HTML Email Preview"
                        srcDoc={selectedEmail.html} 
                        className="w-full h-full border-0 bg-white rounded-md"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-zinc-400 space-y-2 h-full">
                        <Eye className="w-5 h-5" />
                        <p className="text-xs">No HTML body available for this email.</p>
                      </div>
                    )
                  ) : activeTab === "text" ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
                      {selectedEmail.body || "(Empty plain text body)"}
                    </pre>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                      {`From: ${selectedEmail.sender}\nTo: ${selectedEmail.recipient}\nSubject: ${selectedEmail.subject}\nDate: ${selectedEmail.timestamp}\n\n${selectedEmail.body}`}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                <MailIcon className="w-8 h-8 mb-2 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm">Select an email from the inbox to read.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
