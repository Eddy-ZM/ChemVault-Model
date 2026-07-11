# Environment Variables

Do not commit real keys, tokens, private keys, certificates or production `.env` files.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ENV` | Optional | Build/runtime environment name such as `development`, `staging` or `production`. |
| `MOLECULE_API_URL` | Optional | Optional RDKit/FastAPI backend base URL for molecule services. |
| `NEXT_PUBLIC_MOLECULE_API_URL` | Optional | Public molecule API URL for hosted web deployments in this repository. |
| `QUANTUM_API_URL` | Optional | Professional quantum engine base URL. The `/api/chem/quantum/calculate` route forwards native app jobs to this service. |
| `CHEMVAULT_QUANTUM_API_URL` | Optional | Alternate name for `QUANTUM_API_URL`. |
| `QUANTUM_API_TOKEN` | Required with `QUANTUM_API_URL` | Bearer token for the professional quantum engine. Missing authentication disables cloud quantum forwarding. |
| `CHEMVAULT_QUANTUM_API_TOKEN` | Optional | Alternate name for `QUANTUM_API_TOKEN`. |
| `CHEMVAULT_USER_ORIGIN` | Required for cloud quantum | ChemVault User origin used for web, Apple and desktop session/service-access checks. |
| `CHEMVAULT_ALLOWED_ORIGINS` | Optional | Comma-separated additional browser origins allowed to call protected quantum routes. |
| `RATE_LIMIT_KV` | Required binding | Cloudflare KV namespace for prefixed public API, quantum quota, and aggregate product-event records. |
| `CHEMVAULT_MODEL_API_URL` | Optional | Desktop EXE API proxy base URL. Defaults to `https://model.chemvault.science/api/chem`. |
| `CHEMVAULT_APP_VERSION_URL` | Optional | Desktop EXE version manifest URL. Defaults to `https://model.chemvault.science/app-version.json`. |
| `CHEMVAULT_MODEL_VERSION_URL` | Optional | Alternate desktop version manifest URL. |
| `NEXT_PUBLIC_CHEMVAULT_APP_VERSION_URL` | Optional | Public fallback version manifest URL used by packaged desktop builds when the desktop-specific variables are not set. |
| `NEXT_PUBLIC_CHEMVAULT_USER_ORIGIN` | Optional | ChemVault User origin used by sign-in UI. Defaults to `https://user.chemvault.science`. |
| `NEXT_PUBLIC_CHEMVAULT_MODEL_ORIGIN` | Optional | Public Molecule Studio origin used as the return target for ChemVault User OAuth/register redirects. Defaults to `https://model.chemvault.science`. |
| `API_BASE_URL` | Optional | Future native app API base URL override if build settings are added. |
| `REMOTE_CONFIG_URL` | Optional | Future override for `https://api.chemvault.science/app-config.json`. |
| `SENTRY_DSN` | Optional | Crash/error reporting DSN if Sentry is added later. |
| `CLOUDFLARE_API_TOKEN` | Deploy only | Cloudflare deployment token for backend/web workflows. Never commit it. |

The native Apple source compiles without runtime environment variables. TestFlight distribution still requires Xcode signing and archive validation.
