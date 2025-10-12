import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type JSX,
} from "react";
import Keycloak, {
  type KeycloakInstance,
  type KeycloakLoginOptions,
  type KeycloakTokenParsed,
  type KeycloakProfile,
} from "keycloak-js";

import { getKeycloakEnvConfig } from "@/lib/env";

interface AuthContextValue {
  isEnabled: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: KeycloakProfile | null;
  token: string | null;
  tokenParsed: KeycloakTokenParsed | undefined;
  login: (options?: KeycloakLoginOptions) => Promise<void>;
  logout: () => Promise<void>;
  refresh: (minValidity?: number) => Promise<void>;
}

const authConfig = getKeycloakEnvConfig();

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const defaultValue: AuthContextValue = {
  isEnabled: false,
  isLoading: false,
  isAuthenticated: false,
  profile: null,
  token: null,
  tokenParsed: undefined,
  login: () => {
    console.warn("Keycloak is not configured. Set VITE_KEYCLOAK_* variables.");
    return Promise.resolve();
  },
  logout: () => {
    console.warn("Keycloak is not configured. Set VITE_KEYCLOAK_* variables.");
    return Promise.resolve();
  },
  refresh: () => {
    console.warn("Keycloak is not configured. Set VITE_KEYCLOAK_* variables.");
    return Promise.resolve();
  },
};

const SILENT_CHECK_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/silent-check-sso.html`
    : "/silent-check-sso.html";

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const keycloakRef = useRef<KeycloakInstance | null>(
    authConfig
      ? new Keycloak({
          url: authConfig.url,
          realm: authConfig.realm,
          clientId: authConfig.clientId,
        })
      : null,
  );

  const [state, setState] = useState<Omit<AuthContextValue, "login" | "logout" | "refresh">>(
    () => ({
      isEnabled: Boolean(keycloakRef.current),
      isLoading: Boolean(keycloakRef.current),
      isAuthenticated: false,
      profile: null,
      token: null,
      tokenParsed: undefined,
    }),
  );

  useEffect(() => {
    const keycloak = keycloakRef.current;
    if (!keycloak) {
      return;
    }

    let isMounted = true;

    keycloak
      .init({
        onLoad: "check-sso",
        pkceMethod: "S256",
        enableLogging: false,
        silentCheckSsoRedirectUri: SILENT_CHECK_URI,
        checkLoginIframe: true,
        flow: "standard",
      })
      .then(async (authenticated) => {
        if (!isMounted) {
          return;
        }

        if (!authenticated) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
            profile: null,
            token: null,
            tokenParsed: undefined,
          }));
          return;
        }

        try {
          const profile = await keycloak.loadUserProfile();

          if (!isMounted) {
            return;
          }

          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: true,
            profile,
            token: keycloak.token ?? null,
            tokenParsed: keycloak.tokenParsed,
          }));
        } catch (profileError) {
          console.error("Failed to load Keycloak profile", profileError);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: true,
            profile: null,
            token: keycloak.token ?? null,
            tokenParsed: keycloak.tokenParsed,
          }));
        }
      })
      .catch((error) => {
        console.error("Keycloak initialization failed", error);
        if (!isMounted) {
          return;
        }
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          profile: null,
          token: null,
          tokenParsed: undefined,
        }));
      });

    const refreshToken = () => {
      if (!keycloak) {
        return;
      }
      void keycloak
        .updateToken(60)
        .then((refreshed) => {
          if (!refreshed) {
            return;
          }
          setState((prev) => ({
            ...prev,
            token: keycloak.token ?? null,
            tokenParsed: keycloak.tokenParsed,
          }));
        })
        .catch((error) => {
          console.error("Keycloak token refresh failed", error);
          void keycloak.logout({ redirectUri: window.location.origin });
        });
    };

    keycloak.onTokenExpired = () => {
      refreshToken();
    };

    const refreshInterval = window.setInterval(refreshToken, 2 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const login = useCallback(async (options?: KeycloakLoginOptions) => {
    const keycloak = keycloakRef.current;
    if (!keycloak) {
      throw new Error("Keycloak is not configured. Set VITE_KEYCLOAK_* variables.");
    }
    await keycloak.login({ redirectUri: window.location.href, ...options });
  }, []);

  const logout = useCallback(async () => {
    const keycloak = keycloakRef.current;
    if (!keycloak) {
      throw new Error("Keycloak is not configured. Set VITE_KEYCLOAK_* variables.");
    }
    await keycloak.logout({ redirectUri: window.location.origin });
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      profile: null,
      token: null,
      tokenParsed: undefined,
    }));
  }, []);

  const refresh = useCallback(async (minValidity = 60) => {
    const keycloak = keycloakRef.current;
    if (!keycloak) {
      throw new Error("Keycloak is not configured. Set VITE_KEYCLOAK_* variables.");
    }
    const refreshed = await keycloak.updateToken(minValidity);
    if (refreshed) {
      setState((prev) => ({
        ...prev,
        token: keycloak.token ?? null,
        tokenParsed: keycloak.tokenParsed,
      }));
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    if (!state.isEnabled) {
      return defaultValue;
    }

    return {
      ...state,
      login,
      logout,
      refresh,
    };
  }, [login, logout, refresh, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
