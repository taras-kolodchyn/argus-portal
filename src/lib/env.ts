interface KeycloakEnvConfig {
  url: string;
  realm: string;
  clientId: string;
}

export function getKeycloakEnvConfig(): KeycloakEnvConfig | null {
  const rawUrl = import.meta.env.VITE_KEYCLOAK_URL as string | undefined;
  const rawRealm = import.meta.env.VITE_KEYCLOAK_REALM as string | undefined;
  const rawClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID as
    | string
    | undefined;

  const url =
    typeof rawUrl === "string" && rawUrl.trim().length > 0
      ? rawUrl.trim()
      : "https://127.0.0.1:8443";
  const realm =
    typeof rawRealm === "string" && rawRealm.trim().length > 0
      ? rawRealm.trim()
      : "master";
  const clientId =
    typeof rawClientId === "string" && rawClientId.trim().length > 0
      ? rawClientId.trim()
      : "argus-portal-web";

  if (!url || !realm || !clientId) {
    return null;
  }

  return { url, realm, clientId };
}
