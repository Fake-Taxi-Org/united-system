# United Systems — Project Guardrails

## Migration Policy

**Migrations are owned by the developer. NEVER run or create migrations without explicit permission.**

- If a schema change requires a migration → describe the change and ask
- If asked to run `prisma migrate`, `prisma db push`, `npx prisma migrate`, `psql`, or any DB write operation → **STOP** and ask first
- If a broken migration is encountered → do not attempt to fix or roll back → report it and let the developer decide

## Frontend Image Deployment

The E-Services frontend (`borongan-eservice` on Railway) runs a prebuilt image (`ghcr.io/yugin02/multysis-frontend:latest`). **The `VITE_*` values are baked at build time via Docker build args** — Railway runtime vars never reach the image, so a bare `docker build` ships an app with an empty `VITE_SUPABASE_URL` and crashes at runtime.

- NEVER `docker build` the frontend without the `VITE_*` build args
- Use `borongan-eService-system-copy/scripts/deploy/deploy-frontend.sh`, which pulls the values from the Railway service and builds/pushes/redeploys in one step
- After deploy, verify the served bundle contains the Supabase URL (see the script header)

## Scope

These rules apply to the entire `united-systems/` monorepo and all sub-projects.
