#!/bin/bash
set -euo pipefail

# Deploy the citizen programs-portal image to Railway production.
#
# The VITE_* values are BUILD-TIME. The Dockerfile bakes them in via ARG/ENV;
# Railway runtime vars never reach the prebuilt image. Omitting them here
# ships an app with empty SUPABASE_URL / API URLs and crashes at runtime.
#
# Usage: from the repo root (or anywhere), run:
#   borongan-programs-portal/scripts/deploy-portal.sh
#
# Requires: docker (logged into ghcr.io), railway CLI (logged in, linked project).

PORTAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="${SERVICE:-borongan-resident-portal}"
IMAGE="ghcr.io/yugin02/programs-portal:latest"

echo "==> Pulling VITE_* build vars from Railway service '$SERVICE'"
VARS="$(railway variables --service "$SERVICE" --json)"
get_var() {
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1',''))" <<<"$VARS"
}

VITE_BIMS_SERVER_URL="$(get_var VITE_BIMS_SERVER_URL)"
VITE_API_BASE_URL="$(get_var VITE_API_BASE_URL)"
VITE_ESERVICES_PORTAL_URL="$(get_var VITE_ESERVICES_PORTAL_URL)"
VITE_OTHER_PROGRAMS_URL="$(get_var VITE_OTHER_PROGRAMS_URL)"
VITE_SUPABASE_URL="$(get_var VITE_SUPABASE_URL)"
VITE_SUPABASE_ANON_KEY="$(get_var VITE_SUPABASE_ANON_KEY)"
VITE_MAPBOX_TOKEN="$(get_var VITE_MAPBOX_TOKEN)"

if [ -z "$VITE_API_BASE_URL" ] || [ -z "$VITE_SUPABASE_URL" ]; then
  echo "ERROR: VITE_API_BASE_URL / VITE_SUPABASE_URL missing from Railway service"
  exit 1
fi

ARGS=(
  "--build-arg" "VITE_BIMS_SERVER_URL=$VITE_BIMS_SERVER_URL"
  "--build-arg" "VITE_API_BASE_URL=$VITE_API_BASE_URL"
  "--build-arg" "VITE_ESERVICES_PORTAL_URL=$VITE_ESERVICES_PORTAL_URL"
  "--build-arg" "VITE_OTHER_PROGRAMS_URL=$VITE_OTHER_PROGRAMS_URL"
  "--build-arg" "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
  "--build-arg" "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY"
)
[ -n "$VITE_MAPBOX_TOKEN" ] && ARGS+=("--build-arg" "VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN")

echo "==> Building $IMAGE (with build args)"
docker build "${ARGS[@]}" -t "$IMAGE" "$PORTAL_DIR"

echo "==> Pushing $IMAGE"
docker push "$IMAGE"

echo "==> Redeploying service '$SERVICE'"
railway redeploy --service "$SERVICE" --yes --from-source

echo "==> Done. Verify:"
echo "    railway status --service $SERVICE  # expect a new deployment ID, Online"
echo "    curl -sI https://borongan-resident-portal.up.railway.app/ | head -1"
echo "    Visit https://$SERVICE.up.railway.app/profile (must be logged in)"
