import { useEffect, useState, type ReactNode } from "react"

const REPO = "khayson/DevNest"
const RELEASES_LATEST = `https://github.com/${REPO}/releases/latest`
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`
const BUG_URL = `https://github.com/${REPO}/issues/new?template=bug_report.yml`
const FEATURE_URL = `https://github.com/${REPO}/issues/new?template=feature_request.yml`
const DISCUSSIONS_URL = `https://github.com/${REPO}/discussions`
const SOURCE_URL = `https://github.com/${REPO}`

const FEATURES = [
  {
    title: "HTTPS .test sites",
    body: "Park Laravel folders and open https://myapp.test with Caddy and a trusted local CA.",
  },
  {
    title: "Mail & dump trap",
    body: "Catch outgoing mail and VarDumper output in a unified dashboard — no Mailhog setup.",
  },
  {
    title: "One-click runtimes",
    body: "Install Caddy, PHP, Node, MariaDB, and more into ~/.devnest from the app.",
  },
  {
    title: "No terminal required",
    body: "Start services, manage databases, and run onboarding entirely from the desktop UI.",
  },
]

const CHANGELOG_011 = [
  "Onboarding shows immediately — no 8s loading screen",
  "Continue without connection if the daemon is slow",
  "Removed sparkle icons; DevNest branding on setup",
  "Public website, changelog, and GitHub issue templates",
]

function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF4433] to-[#D92D20] text-sm font-black text-white shadow-lg shadow-red-500/20 ${className}`}
    >
      D
    </span>
  )
}

function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 transition-colors hover:text-white ${className}`}
    >
      {children}
      <span aria-hidden className="text-xs opacity-60">
        ↗
      </span>
    </a>
  )
}

export default function App() {
  const [downloadUrl, setDownloadUrl] = useState(RELEASES_LATEST)
  const [version, setVersion] = useState("0.1.1")
  const [loadingRelease, setLoadingRelease] = useState(true)

  useEffect(() => {
    fetch(RELEASES_API)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const tag = (data.tag_name as string)?.replace(/^v/, "") ?? version
        setVersion(tag)
        const asset = (data.assets as { name: string; browser_download_url: string }[])?.find(
          (a) => a.name.endsWith("_x64-setup.exe")
        )
        if (asset) setDownloadUrl(asset.browser_download_url)
      })
      .catch(() => {})
      .finally(() => setLoadingRelease(false))
  }, [])

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="#" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 text-xs" />
            <span className="font-bold tracking-tight">DevNest</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
            <a href="#download" className="hover:text-zinc-100">
              Download
            </a>
            <a href="#features" className="hover:text-zinc-100">
              Features
            </a>
            <a href="#community" className="hover:text-zinc-100">
              Community
            </a>
            <ExternalLink href={SOURCE_URL} className="text-zinc-400">
              GitHub
            </ExternalLink>
          </nav>
          <a
            href={downloadUrl}
            className="rounded-lg bg-gradient-to-r from-[#FF4433] to-[#D92D20] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-500/25 transition hover:brightness-110"
          >
            Download
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800/60 px-4 py-20 sm:px-6 sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,68,51,0.12)_0%,_transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <Logo className="h-14 w-14 text-xl" />
          </div>
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-red-400">
            Free & open source · MIT
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Local Laravel development,
            <span className="block text-zinc-400">without the terminal.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
            Mail trap, dump server, HTTPS <code className="text-zinc-300">*.test</code> sites, and
            service management — from a single Windows desktop app.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              id="download"
              href={downloadUrl}
              className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-gradient-to-r from-[#FF4433] to-[#D92D20] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-red-500/30 transition hover:brightness-110"
            >
              {loadingRelease ? "Loading…" : `Download for Windows v${version}`}
            </a>
            <ExternalLink
              href={RELEASES_LATEST}
              className="rounded-xl border border-zinc-700 px-6 py-3.5 text-sm text-zinc-300 hover:border-zinc-500"
            >
              All releases
            </ExternalLink>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Windows 10/11 · NSIS installer · Updates via About → Check for updates
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-zinc-800/60 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Built for daily Laravel work</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-400">
            Herd-inspired UX: park projects, trust HTTPS, catch mail and dumps — managed from one place.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-zinc-700"
              >
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Changelog */}
      <section className="border-b border-zinc-800/60 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-white">What&apos;s new in v0.1.1</h2>
          <ul className="mt-6 space-y-3">
            {CHANGELOG_011.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <ExternalLink href={`${SOURCE_URL}/blob/main/CHANGELOG.md`} className="text-sm text-zinc-400">
              Full changelog on GitHub
            </ExternalLink>
          </p>
        </div>
      </section>

      {/* Community */}
      <section id="community" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Help us improve DevNest</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-400">
            Found a bug? Want a feature? Share feedback — we track everything on GitHub.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <CommunityCard
              title="Report a bug"
              description="Something broken? Tell us your version, steps, and what you expected."
              href={BUG_URL}
              cta="Open bug report"
            />
            <CommunityCard
              title="Suggest a feature"
              description="Describe your workflow and how DevNest could make it easier."
              href={FEATURE_URL}
              cta="Request a feature"
            />
            <CommunityCard
              title="Reviews & discussion"
              description="Ask questions, share tips, or leave feedback in GitHub Discussions."
              href={DISCUSSIONS_URL}
              cta="Join discussion"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Logo className="h-6 w-6 text-[10px]" />
            <span>DevNest · MIT License</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-500">
            <ExternalLink href={SOURCE_URL}>Source code</ExternalLink>
            <ExternalLink href={RELEASES_LATEST}>Releases</ExternalLink>
            <ExternalLink href={DISCUSSIONS_URL}>Discussions</ExternalLink>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CommunityCard({
  title,
  description,
  href,
  cta,
}: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition hover:border-red-500/40 hover:bg-zinc-900/70"
    >
      <h3 className="font-semibold text-white group-hover:text-red-400">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{description}</p>
      <span className="mt-4 text-sm font-medium text-red-400">
        {cta} <span aria-hidden>→</span>
      </span>
    </a>
  )
}
