# Product Flows

## Windows release

1. CI installs dependencies, audits packages, runs lint and regression tests, builds the website, and launches the Electron smoke test.
2. Electron Builder creates explicit Setup and Portable executables.
3. CI creates SHA256 files and release manifests for both executables.
4. A `vX.Y.Z` tag must match `package.json` exactly.
5. Tagged builds create or update a GitHub Release and verify that Setup, Portable, checksums, and the manifest are present.
6. Desktop update checks only offer a release when GitHub reports a real Setup asset.

## Cloud quantum request

1. Validate browser origin and request size.
2. Forward the shared ChemVault session to ChemVault User.
3. Require active `chemvault_molecule` service access.
4. Validate structure format, atom count, method, charge, and multiplicity.
5. Apply the per-user Cloudflare rate limit.
6. Forward the job to the configured quantum backend with the private backend token.

## Desktop calculation record

1. Hydrate the Electron project store.
2. Merge newer legacy browser records during first migration.
3. Save each completed or failed run to browser cache and the atomic Electron store.
4. Keep the previous Electron file as a backup and retain the existing project export flow.
