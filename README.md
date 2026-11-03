# Cansee UI

The Cansee web app: the public pages (landing, docs, legal) and the signed-in app (Overview,
prompt pages, Sources, Settings). Vue 3, Vite 7, Tailwind CSS 4, shadcn-vue on reka-ui, Pinia
and Vue Router.

The API is the Django project in the separate `CanSee_analytics_App` repository. The app calls
it on its own origin under `/api/v1`: the Vite dev server proxies `/api` in development, and
nginx does the same in production.

## Requirements

- Node.js 20.19 or newer (the Docker build uses Node 20, the CI lint job Node 22)
- The API running locally for anything behind sign-in

## Setup

```bash
npm install
cp .env.example .env.local   # optional; fill in only what you need
npm run dev                  # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000`. To use another backend, set
`VITE_API_URL` in the shell that starts the server, for example
`VITE_API_URL=http://localhost:8001 npm run dev`. `vite.config.js` reads it from the shell
environment, not from `.env` files.

Public sign-up is closed, so local accounts are created from the API repository
(`scripts/create_test_user.py`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint over `src/` (CI runs this) |
| `npm run lint:fix` | ESLint with automatic fixes |
| `npm run format` | Prettier over `src/` |

## Environment variables

Vite bakes `VITE_` variables into the bundle at build time, so every value is public: never put
a secret in one. All of them are optional, and an empty value turns off the feature that needs
it. `.env.example` lists them with a comment each.

| Variable | Used for | When empty |
|---|---|---|
| `VITE_API_URL` | Dev server only: where `/api` is proxied. Read from the shell. | `http://localhost:8000` |
| `VITE_GOOGLE_CLIENT_ID` | Continue with Google (OAuth web client ID) | Google sign-in reports that it is not configured |
| `VITE_MICROSOFT_CLIENT_ID` | Continue with Microsoft (Entra ID application client ID) | Microsoft sign-in is unavailable |
| `VITE_ORG_FEATURES_ENABLED` | `false` hides enterprise single sign-on, mirroring the API's `ORG_FEATURES_ENABLED` | Enterprise single sign-on is shown |
| `VITE_COOKIEBOT_CBID` | Cookiebot domain group ID: the consent banner and the cookie declaration | No consent banner |
| `VITE_FEEDBACK_API_URL` | Origin of the feedback service behind the in-app Help and feedback button | The button is hidden |
| `VITE_ASSET_CDN` | Base URL that large static assets (the onboarding videos) load from | Assets load from the site's own origin |

The Google and Microsoft OAuth clients need `<origin>/auth/google/callback` and
`<origin>/auth/microsoft/callback` registered as redirect URIs.

## Deploy

Every push to `main` deploys to production through `.github/workflows/build.yml`:

1. `lint` runs `npm run lint`. It reports failures but does not block the deploy.
2. `build` builds the `Dockerfile` and pushes `ghcr.io/<repository owner>/cansee-ui`, tagged
   `latest` and with the commit SHA. Only `VITE_GOOGLE_CLIENT_ID` and `VITE_ASSET_CDN`
   (repository variables) are passed as build arguments. Every other `VITE_` variable is empty
   in production builds until it is added to both the workflow and the `Dockerfile`.
3. `deploy` connects to the EC2 host over SSH (repository secrets `EC2_SSH_KEY` and `EC2_HOST`,
   optional `EC2_USER` and `REMOTE_DIR`), runs the `frontend` service of the API repository's
   `docker/docker-compose.prod.yml`, which copies the new build into the volume nginx serves,
   restarts nginx, and checks that `https://cansee.ai/` answers with 200.

The image only carries the built files. nginx, configured in the API repository, serves them
and proxies `/api` to Django.
