# DevNest v0.1.3

**Windows desktop release** — reliable onboarding bootstrap.

## Download

- **Installer:** [DevNest_0.1.3_x64-setup.exe](https://github.com/khayson/DevNest/releases/download/v0.1.3/DevNest_0.1.3_x64-setup.exe)
- **All assets:** [GitHub Releases v0.1.3](https://github.com/khayson/DevNest/releases/tag/v0.1.3)

## What's new

- **Bootstrap retries** — launcher and daemon get up to ~35 seconds to start (no instant "Bootstrap failed")
- **Sidecar fallback** — uses `~/.devnest/bin/devnest.exe` if the bundled binary can't spawn
- **Retry connection** on the Environment onboarding step
- **Cleaner setup errors** — Activity log instead of "Command failed" toasts during onboarding

## Upgrading

**About → Check for updates**, or download and run the new installer.

## Full changelog

See [CHANGELOG.md](../CHANGELOG.md).
