# Runtime Variables

| Name or binding | Used by | Scope/source | Rotation | Failure behavior and risk |
| --- | --- | --- | --- | --- |
| `MOLECULE_API_URL` | Public chemistry gateway | Server variable | On backend change | Falls back to public data providers |
| `RATE_LIMIT_KV` | Public chemistry, cloud quantum and diagnostics | Cloudflare KV binding | Namespace migration | Fails closed; stores prefixed fixed-window counters, low-cardinality aggregates and expiring anonymous event rows |
| `QUANTUM_API_URL` | Cloud quantum gateway | Server variable | On backend change | Cloud calculation unavailable |
| `QUANTUM_API_TOKEN` | Gateway-to-engine authentication | Cloudflare secret | Rotate after exposure/provider change | Fails closed; never bundled client-side |
| `CHEMVAULT_USER_ORIGIN` | Cloud authorization and desktop account proxy | Server/build variable | On service migration | Defaults to production User service |
| `CHEMVAULT_ALLOWED_ORIGINS` | Protected/public API origin policy | Server variable | On approved client change | Unknown browser origins denied |
| `BILLING_API_ORIGIN` | Central cloud-quantum usage service | Server variable | On main API migration | Defaults to the main HTTPS site; invalid production origin denies cloud usage in enforce mode |
| `BILLING_SERVICE_SECRET` | Model-to-main entitlement and usage authentication | Cloudflare secret | Every 90 days and after exposure | Missing or mismatched values deny cloud quantum in enforce mode; never client-visible |
| `BILLING_ENFORCEMENT_MODE` | Cloud-quantum billing rollout | Server variable | During controlled rollout | `shadow` observes without blocking; `enforce` denies Free, exhausted, or unverifiable usage; `off` is non-production only |
| `CHEMVAULT_METRICS_TOKEN` | Maintainer product-funnel report | Cloudflare secret | Every 90 days and after exposure | Missing or mismatched values deny report access |
| `SYNTHETIC_MONITOR_SECRET` | Protected dependency endpoint and scheduled monitor | Pages and GitHub Actions secret | Every 90 days and after exposure | Missing or mismatched values fail the monitor; never bundled client-side |
| `CHEMVAULT_APP_VERSION_URL` | Desktop update policy | Desktop environment | On policy endpoint migration | App enters offline-check state and retries |
| `CHEMVAULT_BUILD_NUMBER` | Monotonic desktop build identity | CI/build environment | Every build | Falls back to generated version metadata |
| `CHEMVAULT_WINDOWS_RELEASE_PUBLISHED` | Same-version update eligibility | CI/build environment | Every publication | Same-version update not offered |
| `CHEMVAULT_GAUSSIAN_TEST_EXE` | Guarded Gaussian live test | Private runner environment | On installation change | Test skips when absent |
| `CHEMVAULT_XTB_TEST_EXE` | Guarded xTB live test | Private runner environment | On installation change | Test skips when absent |
| `CHEMVAULT_PYSCF_TEST_PYTHON` | Guarded PySCF live test | Private runner environment | On environment change | Test skips when absent |
| `CHEMVAULT_ORCA_TEST_EXE` | Guarded ORCA live test | Licensed private runner | On installation change | Test skips when absent |

Secret values belong in Cloudflare secrets or ignored local environment files. No private token may use a `NEXT_PUBLIC_` or `VITE_` prefix, appear in `out/`, or be included in Electron/Apple resources.

Before production enablement, verify the User origin, approved origins, KV binding, main billing `0006` migration, shared billing secret, a Pro allow canary, Free/quota deny canaries, idempotent replay, backend-side capacity ceiling, private quantum token, matching monitor secret in Pages and GitHub Actions, and real GitHub Setup asset. Keep committed configuration in `shadow` until these billing canaries pass.
