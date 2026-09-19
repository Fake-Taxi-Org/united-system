#!/bin/bash
set -euo pipefail

# Deploy the E-Services frontend image to Railway production.
#
# The VITE_* values are BUILD-TIME. The Dockerfile bakes them in via ARG/ENV;
# Railway runtime vars never reach the prebuilt image. Omitting them here
# ships an app with empty SUPABASE_URL and crashes at runtime, so they are
# pulled straight from the Railway service (single source of truth).
#
# Usage: from the repo root (or anywhere), run:
#   borongan-eService-system-copy/scripts/deploy/deploy-frontend.sh
#
# Requires: docker (logged into ghcr.io), railway CLI (logged in, linked project).

FRONTEND_DIR="$(cd "$(dirname "$0")/../../multysis-frontend" && pwd)"
SERVICE="${SERVICE:-borongan-eservice}"
IMAGE="ghcr.io/yugin02/multysis-frontend:latest"

echo "==> Pulling VITE_* build vars from Railway service '$SERVICE'"
VARS="$(railway variables --service "$SERVICE" --json)"
get_var() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1',''))" <<<"$VARS"
}

VITE_API_BASE_URL="$(get_var VITE_API_BASE_URL)"
VITE_PORTAL_URL="$(get_var VITE_PORTAL_URL)"
VITE_SUPABASE_URL="$(get_var VITE_SUPABASE_URL)"
VITE_SUPABASE_ANON_KEY="$(get_var VITE_SUPABASE_ANON_KEY)"
VITE_SUPABASE_TIMEOUT="$(get_var VITE_SUPABASE_TIMEOUT)"

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "ERROR: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from Railway service"
  exit 1
fi

ARGS=(
  "--build-arg" "VITE_API_BASE_URL=$VITE_API_BASE_URL"
  "--build-arg" "VITE_PORTAL_URL=$VITE_PORTAL_URL"
  "--build-arg" "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
  "--build-arg" "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY"
)
[ -n "$VITE_SUPABASE_TIMEOUT" ] && ARGS+=("--build-arg" "VITE_SUPABASE_TIMEOUT=$VITE_SUPABASE_TIMEOUT")

echo "==> Building $IMAGE (with build args)"
docker build "${ARGS[@]}" -t "$IMAGE" "$FRONTEND_DIR"

echo "==> Pushing $IMAGE"
docker push "$IMAGE"

echo "==> Redeploying service '$SERVICE'"
railway redeploy --service "$SERVICE" --yes --from-source

echo "==> Done. Verify:"
echo "    railway status                  # expect a new deployment ID, Online"
echo "    curl -sI https://borongan-e-service.up.railway.app/ | head -1"