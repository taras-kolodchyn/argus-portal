#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="${ROOT_DIR}/.env"
VITE_ENV_FILE="${ROOT_DIR}/.env.local"

# Load environment variables if files exist
default_if_empty() {
  local var_name="$1"
  local default_value="$2"
  local current_value="${!var_name:-}"
  if [[ -z "${current_value}" ]]; then
    printf -v "${var_name}" '%s' "${default_value}"
    export "${var_name}"
  fi
}

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
fi

if [[ -f "${VITE_ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${VITE_ENV_FILE}"
fi

default_if_empty KEYCLOAK_ADMIN admin
default_if_empty KEYCLOAK_ADMIN_PASSWORD P@ssw0rd
default_if_empty VITE_KEYCLOAK_REALM master
default_if_empty VITE_KEYCLOAK_CLIENT_ID argus-portal-web

RAW_APP_BASE="${VITE_APP_BASE_URL:-http://localhost:4173}"

# Normalize origin and redirect URL
APP_ORIGIN="${RAW_APP_BASE%%\*}"
APP_ORIGIN="${APP_ORIGIN%/}"
if [[ -z "${APP_ORIGIN}" ]]; then
  APP_ORIGIN="http://localhost:4173"
fi
APP_ORIGIN="${APP_ORIGIN%/}"
if [[ -z "${APP_ORIGIN}" ]]; then
  APP_ORIGIN="http://localhost:4173"
fi

REDIRECT_URI="${APP_ORIGIN}/*"
SILENT_SSO_URL="https://127.0.0.1:8443/*"

printf "[keycloak-bootstrap] Waiting for Keycloak CLI to accept credentials...\n"
LOGIN_SUCCESS=0
for _ in {1..60}; do
  if docker compose exec -T keycloak \
    /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://127.0.0.1:8080 \
    --realm master \
    --user "${KEYCLOAK_ADMIN}" \
    --password "${KEYCLOAK_ADMIN_PASSWORD}" >/dev/null 2>&1; then
      LOGIN_SUCCESS=1
      break
  fi
  sleep 5
done

if [[ "${LOGIN_SUCCESS}" -ne 1 ]]; then
  echo "Unable to authenticate with Keycloak admin CLI. Ensure 'make keycloak-up' is running and try again." >&2
  exit 1
fi

printf "[keycloak-bootstrap] Logged in successfully.\n"

printf "[keycloak-bootstrap] Ensuring realm '%s' exists...\n" "${VITE_KEYCLOAK_REALM}"
if ! docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get realms/${VITE_KEYCLOAK_REALM} >/dev/null 2>&1; then
  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh create realms -s "realm=${VITE_KEYCLOAK_REALM}" -s enabled=true
fi

printf "[keycloak-bootstrap] Configuring client '%s'...\n" "${VITE_KEYCLOAK_CLIENT_ID}"

CLIENT_PAYLOAD=$(cat <<JSON
{
  "clientId": "${VITE_KEYCLOAK_CLIENT_ID}",
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "redirectUris": ["${REDIRECT_URI}", "${SILENT_SSO_URL}"],
  "webOrigins": ["${APP_ORIGIN}", "https://127.0.0.1:8443"],
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
JSON
)

EXISTING_ID=$(docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients -r "${VITE_KEYCLOAK_REALM}" -q "clientId=${VITE_KEYCLOAK_CLIENT_ID}" --fields id | \
  sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

if [[ -n "${EXISTING_ID}" ]]; then
  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh delete clients/${EXISTING_ID} -r "${VITE_KEYCLOAK_REALM}" >/dev/null
fi

docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh create clients -r "${VITE_KEYCLOAK_REALM}" -f - <<<"${CLIENT_PAYLOAD}"

echo "[keycloak-bootstrap] Done. Keycloak client '${VITE_KEYCLOAK_CLIENT_ID}' is ready."
