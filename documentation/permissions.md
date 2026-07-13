# Permissions And Trust Boundaries

| Resource | Operation | Anonymous | Signed-in user | Required enforcement |
| --- | --- | ---: | ---: | --- |
| Public molecule data | Search/load/generate | Allowed | Allowed | Allowed origin, bounded input, per-IP quota |
| Cloud quantum capacity | Submit calculation | Denied | Pro+ and within quota | Valid session, `chemvault_molecule`, server-resolved subscription, central idempotent daily usage limit, local abuse limit, private backend token |
| Local engines | Configure/run | Local device only | Local device only | Electron preload boundary and explicit executable selection |
| Local projects | Read/write/export/delete | Local device only | Local device only | Electron `userData` store; write confirmation before success UI |
| Product diagnostics | Send aggregate event | Opt-in only | Opt-in only | Local opt-in, client/server allowlists, per-IP quota |
| Product funnel report | Read anonymous event rows and aggregates | Denied | Denied | Maintainer-only bearer token stored as a Cloudflare secret |
| Dependency health | Run production canary | Denied | Denied | Shared scheduled-monitor secret; no public health detail |
| GitHub release | Publish assets | Denied | Maintainer CI only | Tagged workflow with repository `contents: write` |

Cloud quantum identity is derived from ChemVault User on every request rather than trusted from client UI state. The main billing service derives the current plan from subscription state and atomically records the daily job before Model contacts the private engine. The backend token authorizes only gateway-to-engine traffic and missing configuration fails closed once enforcement is enabled.

Desktop engine paths and results are not account-scoped or uploaded automatically. Gaussian and ORCA require the user's valid local license. No database or row-level security rules exist in this repository because it does not own a multi-tenant database.

The molecule library is local-first. Account capability labels do not imply project synchronization, and local structure upload remains a local device capability rather than a cloud entitlement.
