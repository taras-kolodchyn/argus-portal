#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="${ROOT_DIR}/.env"
VITE_ENV_FILE="${ROOT_DIR}/.env.local"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[keycloak-bootstrap] python3 is required to escape JSON payloads." >&2
  exit 1
fi

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
default_if_empty KEYCLOAK_ADMIN_CLIENT_ID argus-backend
default_if_empty KEYCLOAK_ADMIN_CLIENT_SECRET argus-backend-secret
default_if_empty VITE_KEYCLOAK_REALM argus
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

json_escape() {
  python3 - <<'PYCODE'
import json
import sys
value = sys.stdin.read()
print(json.dumps(value))
PYCODE
}

json_array() {
  python3 - "$@" <<'PYCODE'
import json
import sys

values = []
for raw in sys.argv[1:]:
    item = raw.strip()
    if item and item not in values:
        values.append(item)

print(json.dumps(values))
PYCODE
}

require_env_vars() {
  local label="$1"
  shift
  local missing=0
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      printf "[keycloak-bootstrap] Skipping %s identity provider – %s is not set.\n" "${label}" "${var}"
      missing=1
    fi
  done
  return $missing
}

upsert_identity_provider() {
  local alias="$1"
  local payload="$2"

  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh delete "identity-provider/instances/${alias}" -r "${VITE_KEYCLOAK_REALM}" >/dev/null 2>&1 || true
  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh create identity-provider/instances -r "${VITE_KEYCLOAK_REALM}" -f - <<<"${payload}"
  printf "[keycloak-bootstrap] Identity provider '%s' configured.\n" "${alias}"
}

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

printf "[keycloak-bootstrap] Updating realm login settings...\n"
docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh update realms/${VITE_KEYCLOAK_REALM} \
  -s registrationAllowed=true \
  -s verifyEmail=true \
  -s loginWithEmailAllowed=true \
  -s duplicateEmailsAllowed=false >/dev/null

printf "[keycloak-bootstrap] Configuring client '%s'...\n" "${VITE_KEYCLOAK_CLIENT_ID}"

CLIENT_PAYLOAD=$(cat <<JSON
{
  "clientId": "${VITE_KEYCLOAK_CLIENT_ID}",
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "redirectUris": ["*"],
  "webOrigins": ["*"],
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

printf "[keycloak-bootstrap] Configuring service client '%s'...\n" "${KEYCLOAK_ADMIN_CLIENT_ID}"
SERVICE_CLIENT_PAYLOAD=$(cat <<JSON
{
  "clientId": "${KEYCLOAK_ADMIN_CLIENT_ID}",
  "protocol": "openid-connect",
  "publicClient": false,
  "clientAuthenticatorType": "client-secret",
  "secret": "${KEYCLOAK_ADMIN_CLIENT_SECRET}",
  "serviceAccountsEnabled": true,
  "standardFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false
}
JSON
)

EXISTING_SERVICE_ID=$(docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients -r "${VITE_KEYCLOAK_REALM}" -q "clientId=${KEYCLOAK_ADMIN_CLIENT_ID}" --fields id | \
  sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

if [[ -n "${EXISTING_SERVICE_ID}" ]]; then
  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh delete clients/${EXISTING_SERVICE_ID} -r "${VITE_KEYCLOAK_REALM}" >/dev/null
fi

docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh create clients -r "${VITE_KEYCLOAK_REALM}" -f - <<<"${SERVICE_CLIENT_PAYLOAD}"

SERVICE_ACCOUNT_USERNAME="service-account-${KEYCLOAK_ADMIN_CLIENT_ID}"
docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh add-roles -r "${VITE_KEYCLOAK_REALM}" \
  --uusername "${SERVICE_ACCOUNT_USERNAME}" \
  --cclientid realm-management \
  --rolename realm-admin >/dev/null 2>&1 || true
echo "[keycloak-bootstrap] Service client '${KEYCLOAK_ADMIN_CLIENT_ID}' configured with realm-admin role."

configure_google() {
  local alias="google"
  if ! require_env_vars "${alias}" KEYCLOAK_IDP_GOOGLE_CLIENT_ID KEYCLOAK_IDP_GOOGLE_CLIENT_SECRET; then
    return
  fi

  local client_id client_secret scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_GOOGLE_CLIENT_ID}")
  client_secret=$(json_escape <<<"${KEYCLOAK_IDP_GOOGLE_CLIENT_SECRET}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_GOOGLE_SCOPE:-profile email}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "google",
  "displayName": "Google",
  "providerId": "google",
  "enabled": true,
  "storeToken": false,
  "addReadTokenRoleOnCreate": false,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "clientSecret": ${client_secret},
    "defaultScope": ${scope}
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_github() {
  local alias="github"
  if ! require_env_vars "${alias}" KEYCLOAK_IDP_GITHUB_CLIENT_ID KEYCLOAK_IDP_GITHUB_CLIENT_SECRET; then
    return
  fi

  local client_id client_secret scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_GITHUB_CLIENT_ID}")
  client_secret=$(json_escape <<<"${KEYCLOAK_IDP_GITHUB_CLIENT_SECRET}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_GITHUB_SCOPE:-read:user user:email}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "github",
  "displayName": "GitHub",
  "providerId": "github",
  "enabled": true,
  "storeToken": false,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "clientSecret": ${client_secret},
    "defaultScope": ${scope}
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_microsoft() {
  local alias="microsoft"
  if ! require_env_vars "${alias}" KEYCLOAK_IDP_MICROSOFT_CLIENT_ID KEYCLOAK_IDP_MICROSOFT_CLIENT_SECRET; then
    return
  fi

  local client_id client_secret tenant scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_MICROSOFT_CLIENT_ID}")
  client_secret=$(json_escape <<<"${KEYCLOAK_IDP_MICROSOFT_CLIENT_SECRET}")
  tenant=$(json_escape <<<"${KEYCLOAK_IDP_MICROSOFT_TENANT:-common}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_MICROSOFT_SCOPE:-openid profile email offline_access}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "microsoft",
  "displayName": "Microsoft",
  "providerId": "microsoft",
  "enabled": true,
  "storeToken": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "clientSecret": ${client_secret},
    "defaultScope": ${scope},
    "tenant": ${tenant}
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_apple() {
  local alias="apple"
  if ! require_env_vars "${alias}" \
    KEYCLOAK_IDP_APPLE_CLIENT_ID \
    KEYCLOAK_IDP_APPLE_TEAM_ID \
    KEYCLOAK_IDP_APPLE_KEY_ID \
    KEYCLOAK_IDP_APPLE_PRIVATE_KEY; then
    return
  fi

  local client_id team_id key_id private_key scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_APPLE_CLIENT_ID}")
  team_id=$(json_escape <<<"${KEYCLOAK_IDP_APPLE_TEAM_ID}")
  key_id=$(json_escape <<<"${KEYCLOAK_IDP_APPLE_KEY_ID}")
  private_key=$(json_escape <<<"${KEYCLOAK_IDP_APPLE_PRIVATE_KEY}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_APPLE_SCOPE:-name email}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "apple",
  "displayName": "Apple",
  "providerId": "apple",
  "enabled": true,
  "storeToken": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "teamId": ${team_id},
    "keyId": ${key_id},
    "privateKey": ${private_key},
    "defaultScope": ${scope},
    "useKid": "true"
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_facebook() {
  local alias="facebook"
  if ! require_env_vars "${alias}" KEYCLOAK_IDP_FACEBOOK_CLIENT_ID KEYCLOAK_IDP_FACEBOOK_CLIENT_SECRET; then
    return
  fi

  local client_id client_secret scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_FACEBOOK_CLIENT_ID}")
  client_secret=$(json_escape <<<"${KEYCLOAK_IDP_FACEBOOK_CLIENT_SECRET}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_FACEBOOK_SCOPE:-public_profile email}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "facebook",
  "displayName": "Facebook",
  "providerId": "facebook",
  "enabled": true,
  "storeToken": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "clientSecret": ${client_secret},
    "defaultScope": ${scope}
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_instagram() {
  local alias="instagram"
  if ! require_env_vars "${alias}" KEYCLOAK_IDP_INSTAGRAM_CLIENT_ID KEYCLOAK_IDP_INSTAGRAM_CLIENT_SECRET; then
    return
  fi

  local client_id client_secret auth_url token_url userinfo_url scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_INSTAGRAM_CLIENT_ID}")
  client_secret=$(json_escape <<<"${KEYCLOAK_IDP_INSTAGRAM_CLIENT_SECRET}")
  auth_url=$(json_escape <<<"${KEYCLOAK_IDP_INSTAGRAM_AUTH_URL:-https://api.instagram.com/oauth/authorize}")
  token_url=$(json_escape <<<"${KEYCLOAK_IDP_INSTAGRAM_TOKEN_URL:-https://api.instagram.com/oauth/access_token}")
  userinfo_url=$(json_escape <<<"${KEYCLOAK_IDP_INSTAGRAM_USERINFO_URL:-https://graph.instagram.com/me?fields=id,username,account_type,name}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_INSTAGRAM_SCOPE:-user_profile}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "instagram",
  "displayName": "Instagram",
  "providerId": "oidc",
  "enabled": true,
  "storeToken": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "clientSecret": ${client_secret},
    "authorizationUrl": ${auth_url},
    "tokenUrl": ${token_url},
    "userinfoUrl": ${userinfo_url},
    "defaultScope": ${scope},
    "backchannelSupported": "false",
    "validateSignature": "false",
    "useJwksUrl": "false"
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_tiktok() {
  local alias="tiktok"
  if ! require_env_vars "${alias}" KEYCLOAK_IDP_TIKTOK_CLIENT_ID KEYCLOAK_IDP_TIKTOK_CLIENT_SECRET; then
    return
  fi

  local client_id client_secret auth_url token_url userinfo_url scope
  client_id=$(json_escape <<<"${KEYCLOAK_IDP_TIKTOK_CLIENT_ID}")
  client_secret=$(json_escape <<<"${KEYCLOAK_IDP_TIKTOK_CLIENT_SECRET}")
  auth_url=$(json_escape <<<"${KEYCLOAK_IDP_TIKTOK_AUTH_URL:-https://www.tiktok.com/v2/auth/authorize}")
  token_url=$(json_escape <<<"${KEYCLOAK_IDP_TIKTOK_TOKEN_URL:-https://open.tiktokapis.com/v2/oauth/token}")
  userinfo_url=$(json_escape <<<"${KEYCLOAK_IDP_TIKTOK_USERINFO_URL:-https://open.tiktokapis.com/v2/user/info/}")
  scope=$(json_escape <<<"${KEYCLOAK_IDP_TIKTOK_SCOPE:-user.info.basic}")

  local payload
  payload=$(cat <<JSON
{
  "alias": "tiktok",
  "displayName": "TikTok",
  "providerId": "oidc",
  "enabled": true,
  "storeToken": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": ${client_id},
    "clientSecret": ${client_secret},
    "authorizationUrl": ${auth_url},
    "tokenUrl": ${token_url},
    "userinfoUrl": ${userinfo_url},
    "defaultScope": ${scope},
    "backchannelSupported": "false",
    "validateSignature": "false",
    "useJwksUrl": "false"
  }
}
JSON
)
  upsert_identity_provider "${alias}" "${payload}"
}

configure_google
configure_github
configure_microsoft
configure_apple
configure_facebook
configure_instagram
configure_tiktok
