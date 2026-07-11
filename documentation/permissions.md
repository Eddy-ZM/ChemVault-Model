# Permissions And Trust Boundaries

| Resource | Operation | Anonymous | Signed-in user | Required enforcement |
| --- | --- | ---: | ---: | --- |
| Public molecule data | Search/load/generate | Allowed | Allowed | Allowed origin, bounded input, per-IP quota |
| Cloud quantum capacity | Submit calculation | Denied | Conditional | Valid session, `chemvault_molecule`, valid payload, per-user quota, private backend token |
| Local engines | Configure/run | Local device only | Local device only | Electron preload boundary and explicit executable selection |
| Local projects | Read/write/export/delete | Local device only | Local device only | Electron `userData` store; write confirmation before success UI |
| Product diagnostics | Send aggregate event | Opt-in only | Opt-in only | Local opt-in, client/server allowlists, per-IP quota |
| GitHub release | Publish assets | Denied | Maintainer CI only | Tagged workflow with repository `contents: write` |

Cloud quantum authorization is derived from ChemVault User on every request rather than trusted from client UI state. The backend token authorizes only gateway-to-engine traffic and missing configuration fails closed.

Desktop engine paths and results are not account-scoped or uploaded automatically. Gaussian and ORCA require the user's valid local license. No database or row-level security rules exist in this repository because it does not own a multi-tenant database.
