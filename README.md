# Argus Portal MVP

Argus Portal is a React + Vite web application that visualises environmental sensor data for a global audience. The MVP includes a Leaflet map, KPI cards, realtime charts, device management UI, notifications list, and profile preferences with light/dark theme and EN/UA localisation.

## Tech Stack

- React 19 with TypeScript and Vite
- Tailwind CSS + shadcn/ui design system components
- Leaflet + react-leaflet for mapping (OpenStreetMap tiles)
- Recharts for AQI trend visualisations
- react-i18next (EN/UA) with browser language detection
- @tanstack/react-query for client-side data access
- Docker (nginx) image for static hosting
- GitHub Actions for lint/build CI with artifact upload

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs at [http://localhost:5173](http://localhost:5173). The map uses public OpenStreetMap tiles and does not require API keys.

### Available Scripts

- `npm run dev` – start the Vite development server
- `npm run build` – type-check and compile the production bundle to `dist/`
- `npm run preview` – serve the `dist/` bundle locally
- `npm run lint` – run ESLint with type-aware rules (`--max-warnings=0`)

## Features

- Light/Dark theme toggle with system preference bootstrap and localStorage persistence
- English/Ukrainian language switch powered by `react-i18next`
- Dashboard with KPI cards, Leaflet map (Kyiv) and AQI trend chart
- Devices page with status filter, shadcn/ui table, and “Add device” dialog (mock mutation)
- Notifications page with severity styling
- Profile page exposing theme, language, and live Keycloak session details
- Secure registration flow with client-side password hardening and policy consent
- World map view with 100 simulated European sensors for fast situational awareness

## Local Keycloak Stack

The repository ships with a secure-by-default Keycloak + Postgres stack for local development.

1. Copy the secrets template and adjust the values:

   ```bash
   cp .env.example .env
   # Update KC_DB_PASSWORD, KEYCLOAK_ADMIN_PASSWORD, etc.
   ```

2. Generate a self-signed TLS certificate (stored under `certs/keycloak/`):

   ```bash
   ./scripts/generate-keycloak-cert.sh
   ```

3. Start the services:

   ```bash
   docker compose up -d
   ```

4. Access the Keycloak admin console at [https://127.0.0.1:8443](https://127.0.0.1:8443) (accept the self-signed certificate). Sign in with the credentials defined in `.env`.

5. (Optional) Run `make keycloak-bootstrap` to create/update the default `argus-portal-web` client in the configured realm.

### Google reCAPTCHA v3

Set up Google reCAPTCHA v3, create a site key, and add `VITE_RECAPTCHA_SITE_KEY` to `.env.local`. Registration is disabled until a valid token is returned.

> **Note:** `make keycloak-up` now auto-generates `.env` with `admin` / `P@ssw0rd` for both Keycloak and Postgres. This is convenient for local development but must be replaced with strong secrets before any shared deployment.
>
> The same command also creates `.env.local` with default Vite settings:
> ```
> VITE_KEYCLOAK_URL=https://127.0.0.1:8443
> VITE_KEYCLOAK_REALM=master
> VITE_KEYCLOAK_CLIENT_ID=argus-portal-web
> ```
> Ensure a matching public client exists in Keycloak for these values.

### Create the Argus Portal client

Inside Keycloak:

1. Create a new **public** client (e.g. `argus-portal-web`).
2. Set **Valid redirect URIs** to the frontend origins, e.g. `http://localhost:5173/*` and `https://127.0.0.1:8443/*` for silent SSO.
3. Enable **Web origins** (set to `*` during local development or explicitly list the dev origins).
4. Optional: configure default roles / groups for future RBAC.

### Frontend environment

Expose the Keycloak settings to Vite (dev or production) by creating `.env.local` (for Vite dev server) or `.env.production` (for `npm run build`):

```bash
VITE_KEYCLOAK_URL=https://127.0.0.1:8443
VITE_KEYCLOAK_REALM=master
VITE_KEYCLOAK_CLIENT_ID=argus-portal-web
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

Restart the dev server after updating env variables. When configured, the header exposes Log in / Log out actions and the Profile page renders live user metadata.

## Make Targets

Common project commands are wrapped in a `Makefile`:

```bash
make install        # npm install
make dev            # npm run dev
make lint           # npm run lint
make build          # npm run build
make keycloak-cert  # Generate local TLS certificates
make compose-up     # Start Keycloak + Postgres
make compose-down   # Stop the stack
make compose-logs   # Tail stack logs
make docker-run     # Build + run the nginx production image (ports 8080->80)
```

## Docker Image

Build and run the production container locally:

```bash
docker build -t argus-portal .
docker run -p 8080:80 argus-portal
```

The Nginx container serves the Vite `dist/` assets and rewrites unknown routes to `/index.html`.

## Continuous Integration

`.github/workflows/ci.yml` installs dependencies with `npm ci`, runs `npm run lint` and `npm run build`, then uploads the production bundle as a build artifact. The workflow triggers on pushes and pull requests targeting `main`.

## Internationalisation

Translation resources live in `src/i18n/en.json` and `src/i18n/uk.json`. Update both files when adding UI copy. Language choice is stored in `localStorage` and initialised from the browser locale.

## Theme System

`ThemeProvider` (see `src/hooks/useTheme.tsx`) syncs the DOM `classList` with the selected mode (`light`, `dark`, or `system`). Tailwind CSS consumes CSS variables defined in `src/index.css` to restyle shadcn/ui components automatically.

## Mock Data Layer

React Query hooks in `src/hooks/useDashboardData.ts` provide static KPI, device, and notification data with lightweight async simulation. The `useAddDevice` mutation updates the in-memory device list and revalidates cached queries.
