# Scheduled Work

| Job | Schedule | Function | Secrets | Limits and retry | Evidence |
| --- | --- | --- | --- | --- | --- |
| Production dependency monitor | Minute 17 and 47 of every hour | Calls the protected Model endpoint, which checks PubChem, RCSB, ChemVault User, release metadata, and configured cloud quantum health | `SYNTHETIC_MONITOR_SECRET`; the quantum token remains server-side | Two HTTP retries, 45-second request limit, five-minute job timeout, concurrent runs disabled | GitHub Actions history and job summary |

The endpoint is read-only and the job is idempotent. GitHub Actions calls the Pages production domain so edge bot rules on the public custom domain do not block the authenticated canary; the function separately validates the public `model.chemvault.science` version manifest. Missing monitor/release configuration, timeout, or a non-2xx required dependency response fails the run. Cloud quantum is reported as not configured when the optional backend is disabled; when configured, its health becomes required. GitHub Actions history is retained as the operational record.
