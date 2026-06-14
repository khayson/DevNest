# Changelog

All notable changes to DevNest are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.1] - 2026-06-14

### Fixed
- Onboarding shows immediately on first launch instead of an 8-second loading screen
- Environment step offers **Continue without connection** after 12 seconds if the daemon is slow to start
- Duplicate `Plus` import in Sites page (build error)

### Changed
- Removed sparkle icons across the app (onboarding, Sites, Installs, Dumps, About)
- Onboarding header uses the DevNest **D** brand mark
- Release scripts: sidecar build no longer locks running `devnest.exe`, signing password support, publish script fixes

### Added
- Public website (`website/`) for download, changelog, bug reports, and feature requests
- `CHANGELOG.md`, GitHub issue templates, `publish-release.ps1`

## [0.1.0] - 2026-06-14

### Added
- First public release — Windows NSIS installer via GitHub Releases
- Desktop app (Tauri) with Go daemon sidecar and background launcher service
- First-launch onboarding wizard (essentials, permissions, services, optional DB/tunnels)
- Mail trap, dump server, `.test` HTTPS sites (Caddy), PHP/Node runtime installers
- MariaDB runtime installer, hosts DNS fallback, in-app updater (signed `latest.json`)
- MIT license, `DISTRIBUTION.md`, GitHub Actions release workflow

[0.1.1]: https://github.com/khayson/DevNest/releases/tag/v0.1.1
[0.1.0]: https://github.com/khayson/DevNest/releases/tag/v0.1.0
