# Architecture

## Product boundaries

ChemVault Model contains a static Next.js website, Cloudflare Pages Functions, a Windows Electron shell, and a native SwiftUI Apple project. The website performs visualization and approximate analysis. Professional Windows calculations run through locally installed xTB, PySCF, Psi4, Gaussian, or ORCA executables. Commercial binaries are never bundled.

Cloud quantum submission is optional and disabled unless a backend URL, a server-side backend token, ChemVault User authorization, and the Cloudflare rate-limiter binding are all configured. Apple uses its native SwiftUI and SceneKit implementation; it is not a WebView wrapper.

## Data boundaries

- Browser structures remain in the browser unless the user searches a public database or explicitly submits a cloud calculation.
- Desktop engine paths, queue state, projects, logs, checkpoints, and scratch files remain on the local computer.
- Desktop project records use an atomic file under Electron `userData`, with the previous version retained as a backup. Browser storage remains only as a migration cache.
- Product diagnostics are opt-in and contain only allowlisted categorical fields. Molecular structures, search text, logs, file paths, email addresses, and calculation output are excluded.

## External services

- ChemVault User authenticates users and evaluates `chemvault_molecule` service access.
- PubChem and RCSB supply public structure data.
- GitHub Releases is the source of truth for published Windows installers.
- Cloudflare Analytics Engine stores aggregate product event counts.

There are no email delivery jobs, scheduled calculations, or cron-triggered workflows in this repository.
