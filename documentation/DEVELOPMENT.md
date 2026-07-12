# Development And Release

## Prerequisites

- Node.js 22 and npm.
- Windows 10 or 11 for local Windows installer generation.
- Optional locally licensed Gaussian or ORCA installation for guarded live tests.

## Local development

```bash
npm ci
npm run dev
npm run dev:desktop
```

The website is served by Next.js during development. The desktop command builds the static website and launches it inside Electron.

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:electron-smoke
npm run test:electron-workflows
npm run test:visual
npm audit --audit-level=high
```

Guarded engine checks run only when their private runner variables are configured:

```bash
npm run test:gaussian-live
npm run test:engines-live
```

## Windows package

```bash
npm run build:desktop
npm run release:manifest
```

Setup and Portable executables are written to `release/windows/v<version>/`. Windows packaging should run on Windows; the `Build Windows Installer` GitHub Actions workflow provides the same build on `windows-latest`.

Push a tag matching `package.json`, such as `v0.1.0`, only after `main` is approved. The tagged workflow publishes the Setup and Portable executables, checksums, release manifest, and notes to GitHub Releases.

## Operations

The production dependency workflow requires the same `SYNTHETIC_MONITOR_SECRET` in Cloudflare Pages and GitHub Actions. The protected product report uses `CHEMVAULT_METRICS_TOKEN`:

```bash
npm run metrics:report -- --days=30
```

Generate reviewed direct-dependency notices after dependency changes:

```bash
npm run notices:generate
```
