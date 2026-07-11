# Runtime Variables

## Cloud quantum

| Variable or binding | Purpose | Failure behavior |
| --- | --- | --- |
| `QUANTUM_API_URL` | Professional backend base URL | Cloud calculation unavailable |
| `QUANTUM_API_TOKEN` | Private backend bearer token | Backend decides whether anonymous gateway calls are allowed |
| `CHEMVAULT_USER_ORIGIN` | ChemVault User authorization origin | Defaults to `https://user.chemvault.science` |
| `CHEMVAULT_ALLOWED_ORIGINS` | Additional browser origins | Only the production model origin and local development are allowed by default |
| `QUANTUM_RATE_LIMITER` | Per-user Cloudflare Rate Limiting binding | Request fails closed |

## Product diagnostics

| Binding | Purpose | Failure behavior |
| --- | --- | --- |
| `PRODUCT_EVENTS_RATE_LIMITER` | Anti-spam limit | Event is discarded |
| `PRODUCT_ANALYTICS` | Analytics Engine aggregate dataset | Event is discarded |

## Desktop and releases

| Variable | Purpose |
| --- | --- |
| `CHEMVAULT_APP_VERSION_URL` | Remote update policy manifest |
| `CHEMVAULT_BUILD_NUMBER` | Monotonic build number override |
| `CHEMVAULT_WINDOWS_RELEASE_PUBLISHED` | Enables same-version build comparison only after an asset is published |
| `CHEMVAULT_GAUSSIAN_TEST_EXE` | Licensed Gaussian executable used only by the guarded live test |

Secret values belong in Cloudflare secrets or ignored local environment files. Do not commit them.
