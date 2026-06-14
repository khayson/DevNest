# Distributing DevNest

DevNest is **free and open source** ([MIT License](LICENSE)). Distribution is via **GitHub Releases**.

## For users

1. Open [GitHub Releases](https://github.com/khayson/DevNest/releases)
2. Download **DevNest_*_x64-setup.exe** (Windows installer)
3. Run the installer and complete the first-launch onboarding wizard
4. Updates: **About → Check for updates** (desktop app) or install the latest release

## For maintainers — one-time setup

### 1. Generate updater signing keys (once)

Run locally (never commit the `.key` file):

```powershell
.\scripts\generate-updater-keys.ps1
```

This writes:

- `%USERPROFILE%\.devnest\keys\devnest-updater.key` — **private** (keep secret)
- `%USERPROFILE%\.devnest\keys\devnest-updater.key.pub` — **public** (embedded in the app)

The script copies the public key into `frontend/src-tauri/updater.pubkey` for builds.

For CI, store the **private key** in GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`.

### 2. Build a release locally

```powershell
.\scripts\release.ps1
```

Outputs under `frontend/src-tauri/target/release/bundle/`:

- `nsis/DevNest_*_x64-setup.exe` — Windows installer
- `nsis/DevNest_*_x64-setup.exe.sig` — updater signature (when signing key is set)

### 3. Publish to GitHub

Tag and push, then create a release (or use CI):

```powershell
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions (`.github/workflows/release.yml`) builds signed artifacts when you publish a release.

### 4. Updater manifest (`latest.json`)

After each release, upload to the GitHub release:

- The NSIS installer (`.exe`)
- The updater bundle (`.zip` + `.sig` from Tauri when `createUpdaterArtifacts` is enabled)
- `latest.json` — use Tauri’s generated template or `scripts/make-latest-json.ps1`

The app checks:

`https://github.com/khayson/DevNest/releases/latest/download/latest.json`

## Licensing model

| Component | License |
|-----------|---------|
| DevNest core (this repo) | MIT — free for personal and commercial use |
| Future Pro features (optional) | Not included in v1; may ship as a separate commercial add-on later |

## Development installs

Contributors can still use:

- `.\scripts\dev.ps1` — browser + daemon
- `.\scripts\build-desktop.ps1` — local Tauri build without release signing
- `.\scripts\Open-DevNest.vbs` — dev shortcut (builds once if needed)

These are **not** the end-user distribution path.
