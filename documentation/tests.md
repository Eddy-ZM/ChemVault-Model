# Verification And Release Gates

## Required on every Windows build

- ESLint and TypeScript production build.
- Desktop version, queue, project-store, release-record, cloud-security, and IPC contract tests.
- Gaussian input golden routes and parser fixtures.
- Quantum workflow and document export smoke tests.
- Real Electron startup, page-load, and preload-bridge smoke test.
- Setup and Portable asset existence plus GitHub Release verification on tags.

## Licensed engine validation

`npm run test:gaussian-live` runs only when `CHEMVAULT_GAUSSIAN_TEST_EXE` is available on a licensed Windows runner. The canonical water calculation must terminate normally and produce an energy inside the documented tolerance. The test streams the real engine log, removes its scratch directory, and terminates the complete process tree on timeout. `CHEMVAULT_GAUSSIAN_TEST_TIMEOUT_MS` can override the 15-minute default for slower runners. Public CI must not download or bundle Gaussian.

## Product funnel

The opt-in aggregate funnel is:

1. Structure generation completed.
2. Quantum calculation completed or failed, grouped by engine, task, duration bucket, atom band, version, and platform.
3. Export completed, grouped by format.

Initial beta release gates are at least 60% unassisted first-calculation completion, 80% calculation completion after a run starts, and 90% export completion after a result is available. Cloud calculation remains disabled if anonymous repeated requests are accepted or quotas cannot be enforced.
