# Verification And Release Gates

## Existing coverage

| Use case | Rule and negative case | Evidence | CI status |
| --- | --- | --- | --- |
| Cloud quantum access | Anonymous, malformed, missing-token, and exhausted-quota requests never reach the backend | `test-cloud-security.cjs`; quantum route integration | Required |
| Public chemistry APIs | Disallowed origins, missing/exhausted quotas, oversized JSON, long query/SMILES, and invalid identifiers are rejected | `test-cloud-security.cjs`; production TypeScript build | Required |
| Desktop security | Node integration disabled, context isolation/sandbox/web security enabled, required preload bridges present | `test-desktop-contract.cjs` | Required |
| Project records | Normalize, atomically write, read, back up, enforce size limit, and propagate write failure | `test-project-store.cjs`; renderer persistence tests | Required |
| Windows update | Stable version/build ordering, real Setup asset normalization, deferral, stale/unpublished release rejection | `test-versioning.cjs` | Required |
| Windows release | Version-derived output directory, Setup/Portable hashes, manifest and tag/version agreement | `test-release-record.cjs`; Windows workflow | Required |
| Gaussian input/results | Golden routes, parser fixtures, workflow diagnosis, guarded licensed water calculation | Gaussian test scripts | Required except guarded live |
| xTB/PySCF/ORCA results | Production parser sample contracts | `test-engine-parsers.cjs` | Required |
| xTB/PySCF/ORCA execution | Canonical water calculation against configured executables | `test-engines-live.cjs` | Guarded private runner |
| Product funnel | Started/result/completed/failed/export events share an anonymous session journey, exclude unknown attributes, and use isolated KV keys | `test-product-telemetry.cjs`; Functions build | Required |
| Calculation exports | HTML/XLSX/DOCX/PDF/native bundle signatures, metadata, branding and optional logs | `smoke-quantum-exports.cjs` | Required |
| Electron startup | Packaged web assets load and the context-isolated preload bridge is available | `test-electron-smoke.cjs` | Required on Windows |
| Apple native core | iOS/macOS compile plus macOS XYZ parser and bond-estimator tests | `apple-native.yml` | Required when Apple paths change |

## Proposed guarded or manual tests

| Test | Type | Why it is not public CI |
| --- | --- | --- |
| Gaussian/ORCA bridge with site-specific licensed revisions | Guarded live | Commercial installations and licenses are user-provided |
| Windows installer choices and typography | Manual release review | Requires interactive NSIS UI |
| Apple archive, signing, TestFlight receipt and device rendering | Manual/guarded macOS | Requires Apple credentials and devices |
| Cloud quantum backend scientific benchmark set | Guarded live | Requires private backend capacity and reference data |

## Remaining gaps

- No automated visual-regression baseline covers the full quantum workspace at multiple Windows display scales.
- No production synthetic monitor currently verifies PubChem, RCSB, ChemVault User, and cloud quantum availability end to end.
- Scientific regression fixtures verify parsing and canonical smoke calculations, not broad method/basis accuracy against an independent benchmark suite.

## Product funnel

The opt-in aggregate funnel is calculation started, result available, calculation completed or failed, then export completed. Events are grouped by engine, task, duration, atom band, version, platform, first-run status, and a short-lived random session journey. Beta gates must report both event counts and opt-in coverage; they are not representative of users who keep diagnostics disabled.

Initial targets are at least 60% first-run calculation completion, 80% completion after calculation start, and 90% export completion after a result becomes available. Cloud calculation remains disabled if anonymous requests, missing tokens, or unenforced quotas can reach the backend.
