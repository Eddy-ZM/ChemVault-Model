# Environment Variables

Do not commit real keys, tokens, private keys, certificates or production `.env` files.

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ENV` | Optional | Build/runtime environment name such as `development`, `staging` or `production`. |
| `MOLECULE_API_URL` | Optional | Optional RDKit/FastAPI backend base URL for molecule services. |
| `NEXT_PUBLIC_MOLECULE_API_URL` | Optional | Public molecule API URL for hosted web deployments in this repository. |
| `NEXT_PUBLIC_CHEMVAULT_USER_ORIGIN` | Optional | ChemVault User origin used by sign-in UI. Defaults to `https://user.chemvault.science`. |
| `API_BASE_URL` | Optional | Future native app API base URL override if build settings are added. |
| `REMOTE_CONFIG_URL` | Optional | Future override for `https://api.chemvault.science/app-config.json`. |
| `SENTRY_DSN` | Optional | Crash/error reporting DSN if Sentry is added later. |
| `CLOUDFLARE_API_TOKEN` | Deploy only | Cloudflare deployment token for backend/web workflows. Never commit it. |

The current Swift Package app should compile without environment variables. TestFlight distribution still requires a real Xcode app target and signing configuration.
