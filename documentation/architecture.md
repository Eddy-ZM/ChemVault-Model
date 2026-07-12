# Architecture

## Product boundaries

ChemVault Model contains a static Next.js website, Cloudflare Pages Functions, a Windows Electron shell, and a native SwiftUI Apple project. The website provides molecular input, visualization, exports, and approximate electrostatic analysis. Professional Windows calculations execute through locally installed xTB, PySCF, Gaussian, or ORCA engines. Psi4 can be discovered and configured for future bridge work, but is not a selectable calculation engine. Commercial binaries are never bundled.

Cloud quantum submission is optional and fails closed unless a backend URL, private server-side backend token, ChemVault User authorization, and Cloudflare rate limiter are all configured. Apple uses native SwiftUI and SceneKit rather than a WebView wrapper.

## Trust boundaries

- Browser to Pages Functions: public chemistry requests are origin checked, size bounded, and per-IP limited.
- Client to cloud quantum gateway: ChemVault User identity and `chemvault_molecule` access are required before quota is consumed.
- Gateway to quantum backend: only the server receives the private backend token.
- Electron renderer to main process: context-isolated preload methods expose bounded desktop operations; renderer code does not receive Node.js access.
- Desktop to local engines: only a user-selected, configured, or discovered executable is invoked with bounded resources and a calculation timeout.
- Apple client to cloud gateway: the native session token is sent as a bearer token and revalidated by ChemVault User.

## Data boundaries

- Browser structures remain in the browser unless the user searches a public database or explicitly submits a cloud calculation.
- Desktop engine paths, queue state, projects, logs, checkpoints, and scratch files remain on the local computer.
- Desktop project records use an atomic file under Electron `userData`, with the previous version retained as a backup. Browser storage is a migration and compatibility cache.
- A save is reported as successful only after the Electron project store confirms the write. Failed writes leave the calculation result available for manual export.
- Product diagnostics are opt-in and contain only allowlisted categorical fields plus a short-lived random journey identifier. Structures, search text, logs, file paths, emails, and calculation output are excluded.

## External services

- ChemVault User authenticates users and evaluates `chemvault_molecule` service access.
- PubChem and RCSB supply public structure data.
- GitHub Releases is the source of truth for published Windows installers.
- Cloudflare KV stores short-retention fixed-window quota counters, low-cardinality product-event aggregates, and expiring append-only anonymous journey rows under separate key prefixes.

## Known risks and assumptions

- Windows binaries are not code-signed in this release; this is an accepted release limitation.
- Licensed Gaussian and ORCA live tests require private Windows runners with user-provided installations.
- Apple archive, signing, and TestFlight validation require macOS/Xcode and are not proven by Windows development builds.
- Public chemistry endpoints depend on upstream PubChem/RCSB availability even when local quotas and caches are healthy.
- KV fixed-window limits are an application guardrail rather than a billing-grade atomic quota; the private quantum backend must also enforce its own capacity ceiling.

There are no email delivery jobs, scheduled calculations, or embedded AI agents in this repository, so no `emails.md` or `automation.md` is required. A scheduled production dependency monitor is documented in `cron.md`.

## Related documents

- [Product and trust-boundary flows](flows.md)
- [Permissions](permissions.md)
- [Runtime variables](variables.md)
- [Verification map](tests.md)
- [Molecule artifact contract](artifact-contract.md)
- [Scheduled production monitoring](cron.md)
