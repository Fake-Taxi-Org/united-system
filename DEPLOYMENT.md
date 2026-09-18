# United Systems — Deployment Guide

> **Version:** v2 (March 2026)
> **Architecture:** Two Express backends + two Vite frontends sharing one PostgreSQL database

---

## Production Deployment: Vercel + Supabase

This section covers the recommended production setup:

| Layer | Platform | Notes |
|---|---|---|
| BIMS Frontend | **Vercel** | Static SPA |
| E-Services Frontend | **Vercel** | Static SPA |
| BIMS Backend | **Railway / Render / Fly.io** | Must be a persistent server — see why below |
| E-Services Backend | **Railway / Render / Fly.io** | Must be a persistent server — see why below |
| Database | **Supabase** (PostgreSQL + PostGIS) | Shared by both backends |
| Cache / Queue | **Upstash Redis** | Required for E-Services job queues |
| File Storage | **Supabase Storage** or **AWS S3** | Multer local disk won't persist |

> **Why Vercel only for frontends?**
> Both backends are long-running Node.js processes. Vercel's serverless functions have a maximum execution timeout (~10–60 s depending on plan) and do not support:
> - **WebSockets** — E-Services uses Socket.io for real-time notifications
> - **Puppeteer / headless Chrome** — BIMS generates certificate PDFs via Puppeteer (binary too large, needs persistent process)
> - **Bull job queues** — require a persistent Redis connection that survives request boundaries
>
> Use Railway, Render, or Fly.io for both backends. They offer free/hobby tiers and run persistent Node.js servers.

---

### External Services Checklist

Before deploying, provision the following:

#### Required

| Service | What it does | Where to get it |
|---|---|---|
| **Supabase project** | PostgreSQL 15 + PostGIS + Auth | supabase.com → New project |
| **Upstash Redis** | Caching + Bull job queues (E-Services) | upstash.com → Create database |
| **Google Cloud OAuth credentials** | Portal Google Sign-In | console.cloud.google.com → Credentials |
| **Gmail App Password** | Transactional email (both backends) | Google account → Security → App passwords |

#### Optional but recommended

| Service | What it does |
|---|---|
| **Supabase Storage bucket** | Persistent file uploads (replaces Multer local disk) |
| **Twilio** | SMS OTP for portal registration |
| **Sentry / BetterStack** | Error tracking + log aggregation |

---

### Step A — Supabase Setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com). Choose the region closest to your users.

2. **Enable PostGIS** — go to the SQL Editor in the Supabase dashboard and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
   ```
   (The schema.sql does this too, but run it first to avoid errors.)

3. **Run the schema scripts** in order via the Supabase SQL Editor or `psql`:
   ```bash
   # Use your Supabase direct connection string (Settings → Database → Connection string → URI)
   SUPABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"

   psql "$SUPABASE_URL" -f united-database/schema.sql
   psql "$SUPABASE_URL" -f united-database/seed.sql
   psql "$SUPABASE_URL" -f united-database/seed_gis.sql
   ```

4. **Row Level Security (RLS)** — The app manages its own auth at the application layer (JWT). Supabase enables RLS by default but the backends connect as the `postgres` service role, bypassing RLS. This is fine — do **not** add Supabase RLS policies on the shared tables unless you fully understand the schema. Leave RLS disabled or bypassed for application tables.

5. **Get your connection strings** — from Supabase Dashboard → Settings → Database:
   - **Session mode (port 5432)** — use as `DIRECT_URL` in Prisma and as the `PG_*` vars in the BIMS backend
   - **Transaction mode / PgBouncer (port 6543)** — use as `DATABASE_URL` in Prisma (pooled for short-lived serverless-style connections)

   ```env
   # E-Services backend .env — Prisma needs both
   DATABASE_URL=postgresql://postgres:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

   # BIMS backend .env — uses direct pg driver, not Prisma
   PG_HOST=db.[ref].supabase.co
   PG_PORT=5432
   PG_USER=postgres
   PG_PASSWORD=[your-supabase-password]
   PG_DATABASE=postgres
   PG_SSL=true
   ```

   > **Why two URLs for Prisma?** Supabase's PgBouncer (port 6543) doesn't support the `SET` statement that Prisma migrations use. `DIRECT_URL` bypasses the pooler for migrations while `DATABASE_URL` uses the pooler for runtime queries.

6. **File uploads** — by default both backends write uploads to local disk via Multer. This will not persist on Railway/Render (ephemeral containers). Either:
   - Enable the **AWS S3** integration already wired in the E-Services backend (`aws-sdk` is already a dependency — add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION` to env)
   - Or use **Supabase Storage** (create a public bucket and swap the Multer disk storage for `@supabase/storage-js` upload calls)

---

### Step B — Redis Setup (Upstash)

The E-Services backend uses **Bull** job queues and **ioredis** for caching. Redis is required in production.

1. Go to [upstash.com](https://upstash.com) → Create Redis database → choose the same region as your backend host.

2. Copy the **Redis URL** (format: `redis://default:[token]@[host]:[port]`) from the Upstash console.

3. Set in E-Services backend `.env`:
   ```env
   REDIS_URL=redis://default:[token]@[host]:[port]
   ```

4. The BIMS backend also optionally uses Redis for caching (`ioredis` is a dependency). Set in BIMS backend `.env`:
   ```env
   REDIS_HOST=[host]
   REDIS_PORT=[port]
   REDIS_PASSWORD=[token]
   ```

> **Upstash vs self-hosted Redis:** Upstash is serverless-compatible (HTTP-based with per-request billing), works from Railway/Render without a separate Redis service, and has a free tier. It is the simplest option. If your backend host (e.g. Railway) offers a native Redis service, that works too and may have lower latency.

---

### Step C — Backend Deployment (Railway example)

Railway is the closest match to the existing setup (supports PM2, persistent processes, env vars, custom domains).

1. **Create a new Railway project** → Add service → Deploy from GitHub repo.

2. **BIMS Backend service:**
   - Root directory: `barangay-information-management-system-copy/server`
   - Build command: `npm install`
   - Start command: `node server.js`
   - Set all env vars from `server/.env.example`
   - Assign a custom domain: `bims-api.your-domain.com`

3. **E-Services Backend service:**
   - Root directory: `borongan-eService-system-copy/multysis-backend`
   - Build command: `npm install && npm run build && npx prisma generate`
   - Start command: `node dist/index.js`
   - Set all env vars from `multysis-backend/.env.example`
   - Assign a custom domain: `eservice-api.your-domain.com`

4. **Puppeteer on Railway** — Railway runs on Debian-based containers. Add these env vars to the BIMS backend service:
   ```env
   PUPPETEER_NO_SANDBOX=true
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
   ```
   If Chromium fails to launch, install system dependencies via a `nixpacks.toml` or `Dockerfile` (see Step 4 below for the Dockerfile snippet).

---

### Step D — Frontend Deployment (Vercel)

#### BIMS Frontend

1. In Vercel dashboard → New Project → import from GitHub → set root directory to `barangay-information-management-system-copy/client`.
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add a `vercel.json` at `barangay-information-management-system-copy/client/vercel.json`:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
6. Set environment variables in Vercel dashboard (Settings → Environment Variables):
   ```
   VITE_API_BASE_URL        https://bims-api.your-domain.com/api
   VITE_SERVER_URL          https://bims-api.your-domain.com
   VITE_ESERVICE_URL        https://portal.your-domain.com
   VITE_ESERVICE_SERVER_URL https://eservice-api.your-domain.com
   ```

#### E-Services Frontend

1. In Vercel dashboard → New Project → import from GitHub → set root directory to `borongan-eService-system-copy/multysis-frontend`.
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. The existing `vercel.json` proxies to a Railway URL — **update it** to your actual backend URL:
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://eservice-api.your-domain.com/api/$1" },
       { "source": "/socket.io/(.*)", "destination": "https://eservice-api.your-domain.com/socket.io/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
6. Set environment variables in Vercel dashboard:
   ```
   VITE_API_BASE_URL         https://eservice-api.your-domain.com/api
   VITE_BIMS_API_BASE_URL    https://bims-api.your-domain.com/api
   VITE_PORTAL_URL           https://portal.your-domain.com
   VITE_SUPABASE_URL         https://[ref].supabase.co
   VITE_SUPABASE_ANON_KEY    [your anon key from Supabase dashboard]
   VITE_SUPABASE_TIMEOUT     120000
   ```

> **Important:** Vercel injects `VITE_*` variables at **build time**, not runtime. Any change to these variables requires a redeploy. Do not put secrets in `VITE_*` vars — they are embedded in the JavaScript bundle and visible to anyone who inspects it.

---

### Step E — Google OAuth Production Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Under your OAuth 2.0 Client ID, add to **Authorized redirect URIs**:
   ```
   https://eservice-api.your-domain.com/api/auth/portal/google/callback
   ```
3. Add to **Authorized JavaScript origins** (for Supabase Google auth on the frontend):
   ```
   https://portal.your-domain.com
   https://[ref].supabase.co
   ```
4. Set in E-Services backend `.env`:
   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=https://eservice-api.your-domain.com/api/auth/portal/google/callback
   ```

---

### Step F — Pre-launch Checklist

- [ ] Supabase project created, PostGIS enabled, all three SQL scripts applied in order
- [ ] Both backends deployed and health checks return 200
- [ ] `JWT_SECRET` is **identical** in both backend env configs
- [ ] BIMS backend `CORS_ORIGIN` includes both `https://bims.your-domain.com` and `https://portal.your-domain.com`
- [ ] E-Services backend `CORS_ORIGIN` includes `https://portal.your-domain.com`
- [ ] Redis URL configured in E-Services backend (Bull queues will crash on startup without it)
- [ ] File upload storage configured (Supabase Storage or S3) — local Multer disk not suitable for production
- [ ] Google OAuth redirect URIs updated to production URLs
- [ ] `PUPPETEER_NO_SANDBOX=true` set on BIMS backend
- [ ] GeoJSON municipality setup completed (Step 7 below) before any resident registration
- [ ] Smoke tests passed (Step 9 below)

---

## Overview

United Systems consists of four components that must be deployed together:

| Component | Directory | Default Port | Purpose |
|---|---|---|---|
| BIMS Backend | `barangay-information-management-system-copy/server/` | 5000 | Resident/barangay management, registration approvals, certificate generation |
| E-Services Backend | `borongan-eService-system-copy/multysis-backend/` | 3000 | Portal auth, transactions, services catalogue |
| BIMS Frontend | `barangay-information-management-system-copy/client/` | 5173 | Staff admin UI (barangay + municipality) |
| E-Services Frontend | `borongan-eService-system-copy/multysis-frontend/` | 5174 | Resident-facing portal |

**Both backends connect to the same PostgreSQL database.** They share tables: `residents`, `barangays`, `municipalities`, `registration_requests`, `transactions`, `services`, `certificate_templates`.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Both backends |
| PostgreSQL | ≥ 14 (with PostGIS) | Shared database |
| Redis | ≥ 7 | Session caching (optional in dev) |
| Chromium / Chrome | any | Required by Puppeteer for certificate PDF generation |
| `psql` CLI | any | For running schema + seed scripts |

---

## Step 1 — Database Setup

Both backends must point to the same database. Run the scripts once on a fresh database:

```bash
# 1. Apply the schema (creates all tables, indexes, triggers, extensions)
psql -U postgres -d your_database -f united-database/schema.sql

# 2. Load seed data (roles, permissions, services, FAQs, etc.)
psql -U postgres -d your_database -f united-database/seed.sql

# 3. Load GIS municipality/barangay geometry data
psql -U postgres -d your_database -f united-database/seed_gis.sql

# Expected output from seed.sql:
#   Roles:                        4
#   Permissions:                  15
#   Role-Permission mappings:     27
#   Social amelioration settings: 22
#   Government programs:          8
#   FAQs:                         7
#   Services (certificates):      9
```

> **Important:** Always run `schema.sql` → `seed.sql` → `seed_gis.sql` in order.
> Without `seed_gis.sql`, the GeoMap page will show an empty map and barangay auto-creation from the GeoSetup page will fail.

### PostGIS

The schema requires the PostGIS extension. It is automatically enabled by `schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
```

If you are using Supabase, PostGIS is available by default. For self-hosted PostgreSQL, install the `postgis` package for your OS before running the schema.

### Local dev database

```bash
createdb united_systems_dev
psql -U postgres -d united_systems_dev -f united-database/schema.sql
psql -U postgres -d united_systems_dev -f united-database/seed.sql
```

---

## Step 2 — Environment Variables

### Critical: JWT_SECRET must be identical on both backends

The BIMS backend validates JWT tokens issued by the E-Services backend (e.g. residents calling BIMS household routes). Both backends must share the same secret:

```env
# Both .env files must have the exact same value:
JWT_SECRET=your-long-random-secret-min-32-chars
```

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

### BIMS Backend — `barangay-information-management-system-copy/server/.env`

See `.env.example` in the same directory for the full template. Key variables:

```env
# Database (same instance as E-Services backend)
PG_USER=postgres
PG_HOST=localhost
PG_DATABASE=united_systems
PG_PASSWORD=your_db_password
PG_PORT=5432
PG_SSL=false

# JWT — must match E-Services backend exactly
JWT_SECRET=your-long-random-secret-min-32-chars
JWT_EXPIRES_IN=1d

PORT=5000
NODE_ENV=production

# CORS — comma-separate to allow both frontends
# The E-Services portal calls BIMS directly for household data
CORS_ORIGIN=https://bims.your-domain.com,https://portal.your-domain.com

# Portal URL — used in QR codes and redirect notices
PORTAL_URL=https://portal.your-domain.com

# Puppeteer (required for certificate PDF generation — see Step 4)
# PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# PUPPETEER_NO_SANDBOX=true

# Email (optional)
GMAIL_USER=your_gmail@gmail.com
GMAIL_PASS=your_gmail_app_password

# First admin account (created on first boot)
DEFAULT_ADMIN_EMAIL=admin@your-domain.gov.ph
DEFAULT_ADMIN_PASSWORD=ChangeThisPassword123!
DEFAULT_MUNICIPALITY_NAME=Your Municipality
DEFAULT_REGION=Your Region
DEFAULT_PROVINCE=Your Province
```

---

### E-Services Backend — `borongan-eService-system-copy/multysis-backend/.env`

See `.env.example` in the same directory for the full template. Key variables:

```env
# Database (Prisma — same DB as BIMS backend)
DATABASE_URL=postgres://user:password@host:5432/dbname
DIRECT_URL=postgres://user:password@host:5432/dbname

# JWT — must match BIMS backend exactly
JWT_SECRET=your-long-random-secret-min-32-chars
JWT_REFRESH_SECRET=another-long-random-secret-for-refresh

PORT=3000
NODE_ENV=production

# CORS — E-Services portal frontend
CORS_ORIGIN=https://portal.your-domain.com

# Portal URL (used in approval email login links)
PORTAL_URL=https://portal.your-domain.com

# Email (Gmail App Password)
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=noreply@your-domain.gov.ph

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://eservice-api.your-domain.com/api/auth/portal/google/callback
```

---

### BIMS Frontend — `barangay-information-management-system-copy/client/.env`

```env
VITE_API_BASE_URL=https://bims-api.your-domain.com/api
VITE_SERVER_URL=https://bims-api.your-domain.com
VITE_ESERVICE_URL=https://portal.your-domain.com

# E-Services backend base URL — used to resolve household images uploaded via the portal
# Must point to the E-Services backend (not BIMS). Required for household photos to display.
VITE_ESERVICE_SERVER_URL=https://eservice-api.your-domain.com
```

---

### E-Services Frontend — `borongan-eService-system-copy/multysis-frontend/.env`

```env
VITE_API_BASE_URL=https://eservice-api.your-domain.com/api
VITE_BIMS_API_BASE_URL=https://bims-api.your-domain.com/api
VITE_PORTAL_URL=https://portal.your-domain.com

# Supabase (for Google OAuth only)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_TIMEOUT=120000
```

---

## Step 3 — Install Dependencies

```bash
# BIMS backend
cd barangay-information-management-system-copy/server && npm install

# E-Services backend
cd borongan-eService-system-copy/multysis-backend
npm install
npx prisma generate          # regenerate Prisma client against current schema

# BIMS frontend
cd barangay-information-management-system-copy/client && npm install

# E-Services frontend
cd borongan-eService-system-copy/multysis-frontend && npm install
```

---

## Step 4 — Puppeteer (PDF Generation)

The BIMS backend generates certificate PDFs using Puppeteer (headless Chrome). Chromium is downloaded automatically on `npm install`.

**Linux server / no display:**

```env
# Add to BIMS backend .env:
PUPPETEER_NO_SANDBOX=true
```

**Docker:** Install Chromium dependencies in your Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y \
    chromium fonts-liberation libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdbus-1-3 libnspr4 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxrandr2 xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_NO_SANDBOX=true
```

---

## Step 5 — Build Frontends

```bash
# BIMS frontend
cd barangay-information-management-system-copy/client
npm run build
# Output → dist/ (serve as static files)

# E-Services frontend
cd borongan-eService-system-copy/multysis-frontend
npm run build
# Output → dist/ (serve as static files)
```

Serve `dist/` with nginx, Caddy, or a CDN. For SPAs, configure your server to serve `index.html` for all routes.

---

## Step 6 — Start Backends

```bash
# BIMS backend
cd barangay-information-management-system-copy/server
node server.js
# With PM2:  pm2 start server.js --name bims-backend

# E-Services backend
cd borongan-eService-system-copy/multysis-backend
npm run build               # compile TypeScript → dist/
node dist/index.js
# With PM2:  pm2 start dist/index.js --name eservice-backend
```

Health checks:
- BIMS: `GET http://localhost:5000/health`
- E-Services: the app logs its port on startup

---

## Step 7 — Initial Municipality Setup (GeoJSON)

**This must be done before any resident can register.**

The GeoJSON setup auto-creates all barangays for the municipality from official PSGC data. Without this, the portal's address dropdown is empty and registration requests have no barangay to route to.

### Prerequisites for setup

The `gis_municipality` and `gis_barangay` tables must contain PSGC GeoJSON polygon data. Load the included GIS seed before running setup:

```bash
psql "$DB_URL" -f united-database/seed_gis.sql
```

This populates Eastern Samar province geometry data. For a different province see **Deploying to a Different Province** below.

### Running setup

1. Log in to the BIMS admin UI as the **municipality admin**
2. Go to **Setup** in the sidebar
3. The interactive map shows all municipalities in the loaded GeoJSON
4. Click your municipality on the map
5. Enter **Province** and **Region** in the confirmation dialog
6. Click **Confirm**

All barangays are auto-created from GIS data. The municipality is marked `active` and the portal becomes functional.

### Deploying to a Different Province

The included `seed_gis.sql` contains Eastern Samar municipality and barangay geometries only. To deploy in another province:

1. Obtain GeoJSON polygon data for your province's municipalities and barangays (available from the Philippine Statistics Authority PSGC portal or OpenStreetMap/GADM exports)
2. Review `united-database/prepare.sh` — it converts shapefiles/GeoJSON to SQL INSERT statements targeting `gis_municipality` and `gis_barangay`. Adapt the input file paths and PSGC code mappings for your province.
3. Run `prepare.sh` to generate a new `seed_gis.sql` for your province
4. Load it with `psql "$DB_URL" -f united-database/seed_gis.sql`

The seed must populate `gis_municipality` (municipal boundaries + PSGC municipality codes) and `gis_barangay` (barangay boundaries + PSGC barangay codes) before the setup wizard can auto-create barangays.

---

## Step 8 — Verify with the Test Script

```bash
# Run from the repository root
chmod +x united-database/test_mutations_bims.sh

# Default (local dev):
./united-database/test_mutations_bims.sh

# Custom DB / server:
DB_URL="postgresql://user:pass@host/dbname" \
BIMS_URL="http://your-server:5000/api" \
./united-database/test_mutations_bims.sh
```

Expected: all tests PASS, 0 FAIL.

---

## Step 9 — End-to-End Smoke Tests

Run these manually in order after a fresh deployment:

### 1 — GeoJSON setup → barangays exist
- BIMS admin → Setup → click municipality → confirm
- Verify barangays appear in the Barangays list

### 2 — Resident registration → approval → login
- Portal `/portal/register` → 4-step wizard
- BIMS admin → Registrations → Approve
- Resident receives `resident_id` (e.g. `RES-2026-0000001`)
- Resident logs in with username/password
- My Profile shows correct address; My ID shows QR card

### 3 — Service request (resident)
- Portal → E-Government → Request Service
- Submit form → reference number shown
- Portal → Track Application → enter reference

### 4 — Guest application
- Log out → E-Government → Apply as Guest
- Barangay Certificate services show "residents only" notice
- Select a non-certificate service → submit → reference number shown
- Portal → Track → enter reference

### 5 — Certificate template + PDF
- BIMS municipality admin → Certificate Templates → New Template (Barangay Clearance)
- BIMS barangay staff → Certificates → pending clearance request → Generate & Download
- PDF downloads with resident name filled in

### 6 — Bulk ID
- BIMS municipality admin → Bulk ID → select barangay → Download PDF
- PDF contains ID cards for active residents

---

## Troubleshooting

### PDF generation fails (`Failed to launch the browser process`)
Add `PUPPETEER_NO_SANDBOX=true` to BIMS backend `.env`.

### CORS errors in browser console
`CORS_ORIGIN` in both backend `.env` files must include the exact origin (protocol + host + port, no trailing slash) of the calling frontend. Comma-separate multiple origins.

### Portal household shows 401
The E-Services portal calls the BIMS backend directly for household data. Both backends must have **identical** `JWT_SECRET` values.

### "Barangay not found" during registration
Complete Step 7 (GeoJSON municipality setup) before accepting registrations.

### Resident can log in with `pending` status
Ensure the E-Services backend is on the latest version. `auth.service.ts → portalLogin()` must check for `pending` and `rejected` statuses in addition to `inactive`.

### Prisma schema drift
If you get Prisma errors, regenerate the client:
```bash
cd borongan-eService-system-copy/multysis-backend
npx prisma generate
```

---

## E-Services Frontend Image Deploy (Railway)

The E-Services frontend runs a prebuilt Docker image hosted on GHCR (`ghcr.io/yugin02/multysis-frontend:latest`) and linked to the Railway service `borongan-eservice`. It is NOT built from the repo source on Railway — the image must be built locally and pushed.

### Why VITE_* build args are required

`VITE_*` values are consumed at **build time** by Vite. The Dockerfile bakes them in via ARG/ENV so they land in the static JS bundle. Railway runtime variables never reach the prebuilt image, so a bare `docker build` ships an app with an empty `VITE_SUPABASE_URL` and crashes at page load.

### Deploy

```bash
# Recommended: use the deploy script, which pulls the values from
# the Railway service (single source of truth) and handles everything:
borongan-eService-system-copy/scripts/deploy/deploy-frontend.sh
```

Or manually:

```bash
cd borongan-eService-system-copy/multysis-frontend

# 1. Pull build vars from Railway
VARS=$(railway variables --service borongan-eservice --json)

# 2. Build with --build-arg for each VITE_* var (see .env.example for names)
#    VITE_SUPABASE_TIMEOUT is optional (defaults to 120000 in code).
docker build \
  --build-arg VITE_API_BASE_URL=... \
  --build-arg VITE_PORTAL_URL=... \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  -t ghcr.io/yugin02/multysis-frontend:latest .

# 3. Push + redeploy
docker push ghcr.io/yugin02/multysis-frontend:latest
railway redeploy --service borongan-eservice --yes --from-source
```

### Post-deploy verification

```bash
railway status   # expect new deployment ID + Online
curl -sI https://borongan-e-service.up.railway.app/ | head -1   # 200
curl -s https://borongan-e-service.up.railway.app/ | grep -oE 'assets/index-[^"]+\.js'
```

The served `index-*.js` bundle should match the local `dist/index.html` output (hash may differ between builds due to dependency resolution, but the app must load without `supabaseUrl is required`).

---

## Key Design Notes

| Topic | Detail |
|---|---|
| **Single approver** | Registration requests are approved/rejected in BIMS only. The E-Services admin panel shows them read-only to prevent race conditions. |
| **No manual barangay entry** | Barangays are always auto-created from GeoJSON via Setup. |
| **Resident status lifecycle** | `pending` → `active` (on approval) or `pending` → `rejected`. Active residents can log in; pending and rejected cannot. |
| **Guest transactions** | Transactions with no `resident_id` are guest submissions. They appear in the E-Services admin list but NOT in the BIMS certificate queue (no barangay to route to). |
| **Certificate templates** | One active template per certificate type per municipality. All barangays in the municipality share the same template. Templates are managed by the municipality admin in BIMS. |
| **Shared database** | Both backends write to the same PostgreSQL instance. There is no HTTP communication between the two backends — they share data via the DB. The only exception is the E-Services frontend calling the BIMS backend directly for household data (cross-origin, handled via CORS + JWT). |

---

*United Systems Deployment Guide — v2, March 2026*
