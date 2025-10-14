interface KeycloakEnvConfig {
  url: string;
  realm: string;
  publicClientId: string;
  adminClientId: string | null;
}

export function getKeycloakEnvConfig(): KeycloakEnvConfig | null {
  const rawUrl = import.meta.env.VITE_KEYCLOAK_URL as string | undefined;
  const rawRealm = import.meta.env.VITE_KEYCLOAK_REALM as string | undefined;
  const rawClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID as
    | string
    | undefined;
  const rawAdminClientId = import.meta.env.VITE_KEYCLOAK_ADMIN_CLIENT_ID as
    | string
    | undefined;

  const normalizedUrl =
    typeof rawUrl === "string" && rawUrl.trim().length > 0
      ? rawUrl.trim()
      : "https://127.0.0.1:8443";
  const urlWithoutSlash = normalizedUrl.replace(/\/+$/, "");
  const url = urlWithoutSlash.endsWith("/auth")
    ? urlWithoutSlash.slice(0, -5)
    : urlWithoutSlash;
  const realm =
    typeof rawRealm === "string" && rawRealm.trim().length > 0
      ? rawRealm.trim()
      : "argus";
  const publicClientId =
    typeof rawClientId === "string" && rawClientId.trim().length > 0
      ? rawClientId.trim()
      : "argus-portal-web";
  const adminClientId =
    typeof rawAdminClientId === "string" && rawAdminClientId.trim().length > 0
      ? rawAdminClientId.trim()
      : null;

  if (!url || !realm || !publicClientId) {
    return null;
  }

  return { url, realm, publicClientId, adminClientId };
}
