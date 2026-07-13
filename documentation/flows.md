# Product Flows

## ChemVault account sign-in

- Actor: website or desktop user who chooses to sign in; molecule tools remain available without an account.
- Sequence: Molecule Studio validates a same-origin return path, opens ChemVault User email/password or Apple, Google, or GitHub authentication, then returns the session to the requested Model page. Desktop requests pass through the local authenticated proxy so cookies remain compatible with the packaged app.
- Deny cases: invalid credentials, unavailable provider, unsafe return URL, expired session, or denied `chemvault_molecule` permission for protected cloud features.
- Side effects: ChemVault User owns the account session. Model receives only the session result and synchronized profile/library data; it never stores third-party OAuth secrets.

## Public molecule lookup and generation

- Actor: website or desktop user.
- Preconditions: allowed origin and available public chemistry quota.
- Sequence: UI sends a bounded query or structure request, Pages Functions applies per-IP quota and input limits, then calls the configured molecule backend or PubChem/RCSB fallback.
- Deny cases: disallowed origin, missing limiter, exhausted quota, malformed CID/PDB ID, oversized query, or oversized JSON.
- Side effects: upstream network calls and cacheable public responses; no account or project writes.

## Cloud quantum request

- Actor: signed-in web or Apple user with Molecule service access and a Pro-or-higher subscription.
- Sequence: validate origin and body size, forward the session to ChemVault User, require `chemvault_molecule`, validate method/structure/charge/spin, require backend URL/token/limiter, apply the local abuse limit, submit an idempotent usage-consumption request to the main billing service, then call the private backend only when the subscription and daily quota allow it.
- Deny cases: anonymous session, denied service, Free plan, exhausted daily quota, disallowed origin, unsupported input, missing billing/private configuration, or unavailable rate-limit storage. Enforcement fails closed; shadow mode records the observed billing decision without blocking the request.
- Side effects: one daily cloud-quantum job is recorded centrally before private capacity is used. Model generates the internal accounting ID so clients cannot reuse a key to bypass quota; replaying that trusted internal ID does not double count. Local desktop engines are excluded from SaaS usage and billing.

## Desktop engine setup

- Actor: Windows desktop user.
- Sequence: detect configured engines, let the user select an existing executable or install managed PySCF, verify the executable/version, and persist only local paths.
- Deny cases: missing executable, failed version probe, failed managed installation, or unsupported direct Psi4 execution.
- Side effects: optional local Python environment creation and local engine configuration writes.

## Desktop calculation and project record

- Actor: Windows desktop user with a loaded 3D structure and ready engine.
- Sequence: preflight structure/charge/spin, create bounded engine input, run with timeout/cancellation/progress, parse output, build the run manifest, write history, and await the atomic Electron project-store write.
- Deny cases: failed preflight, unavailable engine, invalid executable, timeout, cancellation, parser failure, or project storage failure.
- Side effects: scratch files are removed after use; completed and failed runs are recorded. Storage failure is surfaced while keeping the current result exportable.

## Calculation export

- Actor: user with a current calculation result or project.
- Sequence: generate the selected document/native file, add ChemVault branding and metadata where applicable, start the download, then emit an opt-in `export_completed` event.
- Deny cases: required result, checkpoint, optimized geometry, or bridge tool output is unavailable.
- Side effects: writes only the user-selected export destination and aggregate diagnostic event.

## Product diagnostics and maintainer report

- Actor: user who explicitly enabled diagnostics.
- Sequence: client adds version, platform, short-lived journey, and allowlisted categorical attributes; Pages Functions origin-checks, rate-limits, revalidates the allowlist, increments a low-cardinality daily aggregate, and appends a short-retention anonymous journey event row. Reports read rows in bounded batches, stop at 20,000 rows, and report truncation and whether at least 30 journeys are available.
- Deny cases: diagnostics disabled, unsupported event/attribute, missing bindings, disallowed origin, oversized event, or exhausted quota.
- Side effects: aggregate counts and anonymous journey event rows only; no molecular or account payload. A bearer-protected maintainer endpoint calculates start, completion, result, and export conversion for a bounded 1-90 day window.

## Production dependency monitor

- Actor: scheduled GitHub Actions workflow using a shared secret.
- Sequence: call the protected production endpoint, then verify PubChem and RCSB upstreams, Model's public PubChem/PDB routes, ChemVault User health, the login page and Apple/Google/GitHub redirect contracts, the public version manifest, the latest Windows installer/portable/checksum assets, and the configured cloud quantum health endpoint.
- Deny cases: missing or mismatched monitor secret, failed required dependency, timeout, or non-success response.
- Side effects: workflow result and summary only. Cloud quantum is reported as optional and skipped when it is intentionally not configured.

## Windows release and update

- Actor: maintainer and installed desktop application.
- Sequence: CI audits all dependencies, runs lint/tests/build/Electron smoke, derives `release/windows/v<package.version>`, builds Setup and Portable, writes hashes/manifests, publishes tagged assets, and verifies them. The app compares current build/version against a real GitHub Setup asset and remote minimum policy.
- Deny cases: tag/version mismatch, missing asset, checksum/manifest failure, stale or draft release, or invalid download URL.
- Side effects: GitHub Release assets are published; required updates block use while optional updates may be deferred.
