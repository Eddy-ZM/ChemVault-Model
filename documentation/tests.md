# Verification And Release Gates

## Existing coverage

| Use case | Rule and negative case | Evidence | CI status |
| --- | --- | --- | --- |
| Cloud quantum access | Anonymous, malformed, missing-token, Free-plan, unavailable-billing, and exhausted-quota requests never reach the backend; paid usage returns remaining quota | `test-cloud-security.cjs`; quantum route integration | Required |
| Cloud quantum usage | Main billing accepts only the shared service secret, applies Pro+ daily limits atomically, and treats a repeated request ID as one job | Main `tests/billing-api.test.mjs`; Model `test-cloud-security.cjs` | Required before enforce |
| Public chemistry APIs | Disallowed origins, missing/exhausted quotas, oversized JSON, long query/SMILES, and invalid identifiers are rejected | `test-cloud-security.cjs`; production TypeScript build | Required |
| Desktop security | Node integration disabled, context isolation/sandbox/web security enabled, required preload bridges present | `test-desktop-contract.cjs` | Required |
| Project records | Normalize, atomically write, read, back up, enforce size limit, and propagate write failure | `test-project-store.cjs`; renderer persistence tests | Required |
| Windows update | Stable version/build/release identity ordering, real Setup asset normalization, deferral, stale/unpublished release rejection | `test-versioning.cjs`; `test-version-manifest.cjs` | Required |
| Windows release | Version-derived output directory, Setup/Portable hashes, manifest and tag/version agreement | `test-release-record.cjs`; Windows workflow | Required |
| Gaussian input/results | Golden routes, parser fixtures, workflow diagnosis, guarded licensed water calculation | Gaussian test scripts | Required except guarded live |
| xTB/PySCF/ORCA results | Production parser sample contracts | `test-engine-parsers.cjs` | Required |
| xTB/PySCF/ORCA execution | Canonical water calculation against configured executables | `test-engines-live.cjs` | Guarded private runner |
| Product funnel | Started/result/completed/failed/export events share an anonymous session journey, exclude unknown attributes, and use isolated KV keys | `test-product-telemetry.cjs`; Functions build | Required |
| Calculation exports | HTML/XLSX/DOCX/PDF/native bundle signatures, metadata, branding and optional logs | `smoke-quantum-exports.cjs` | Required |
| Electron startup | Packaged web assets load and the context-isolated preload bridge is available | `test-electron-smoke.cjs` | Required on Windows |
| Electron critical workflows | Welcome, workspace tabs, XYZ upload, non-zero 3D canvas, structure export, unavailable-engine progress/error, cancellation, queue recovery, login providers, structure details and engine preference persistence | `test-electron-workflows.cjs`; repeated against final `win-unpacked` executable | Required on Windows |
| Engine self-test | Configured engine runs canonical water and validates engine-specific energy, normal termination, three atom charges, charge conservation, dipole and engine version | `test-engine-self-test.cjs`; desktop bridge | Required |
| Desktop package contents | ASAR contains required static/runtime files, excludes `node_modules`, remains below the size ceiling, and uses the approved atom icon | `verify-desktop-package.cjs`; `test-desktop-contract.cjs`; final EXE icon extraction | Required on Windows |
| Quantum compatibility | Neutral, ionic, open-shell, heavy-element rejection and transition-metal basis compatibility | `preflight-benchmarks.json`; `test-quantum-workflow.cjs` | Required |
| Apple native core | iOS/macOS compile plus macOS XYZ parser and bond-estimator tests | `apple-native.yml` | Required when Apple paths change |
| Windows layout | Home, molecule workspace, login, molecule library, and loaded structure-details screenshots at 100%, 125%, and 200% device scales | `visual-regression.yml`; `tests/visual` | Required when UI paths change |
| Production dependencies | Protected monitor verifies upstream and Model chemistry routes, User health/login/OAuth contracts, version policy, Windows Release assets/checksums, and configured cloud quantum health | `synthetic-monitor.yml`; `functions/api/internal/dependencies.ts` | Scheduled and manual |
| Independent scientific anchor | NIST CCCBDB water geometry/dipole fixture; guarded engines compare reported dipoles | `water-nist.json`; scientific/live test scripts | Fixture required; engines guarded |

## Proposed guarded or manual tests

| Test | Type | Why it is not public CI |
| --- | --- | --- |
| Gaussian/ORCA bridge with site-specific licensed revisions | Guarded live | Commercial installations and licenses are user-provided |
| Windows installer choices and typography | Manual release review | Requires interactive NSIS UI |
| Apple archive, signing, TestFlight receipt and device rendering | Manual/guarded macOS | Requires Apple credentials and devices |
| Cloud quantum backend scientific benchmark set | Guarded live | Requires private backend capacity and reference data |

## Accepted validation boundaries

- The independent numerical anchor is NIST water. ChemVault validates bridge input, compatibility, execution and parsing; it does not claim independent broad method/basis accuracy beyond the connected engine.
- Licensed engine revisions remain guarded because commercial installations are user-provided. Cloud quantum is reported as optional while disabled and becomes a required health check when configured.

## Accepted gaps

- The published Windows `v0.1.0` Setup and Portable binaries have checksum evidence but are not code-signed, so the release cannot claim Windows publisher identity yet.
- Apple archive, signing, notarization, TestFlight receipt, and device rendering still require a macOS runner with Apple credentials.
- Broad licensed-engine and cloud-backend scientific validation remains guarded by site-specific installations, capacity, and reference datasets.

## Product funnel

The opt-in funnel is calculation started, result available, calculation completed or failed, then export completed. Low-cardinality attributes support aggregate breakdowns; append-only anonymous journey rows support conversion calculations without concurrent event overwrite. Reports include the number of opted-in journeys, scanned rows, the 20,000-row cap, truncation state, and whether the 30-journey minimum has been reached. No event is sent when diagnostics are disabled, so no non-consenting denominator is collected or inferred.

Initial targets are at least 60% first-run calculation completion, 80% completion after calculation start, and 90% export completion after a result becomes available. Cloud calculation remains disabled if anonymous requests, missing tokens, or unenforced quotas can reach the backend.
