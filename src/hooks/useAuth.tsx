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
  isReady: boolean;
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
  isReady: true,
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

const KEYCLOAK_INIT_TIMEOUT_MS = 1500;

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      onTimeout();
      reject(new Error("Keycloak init timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timer);
        reject(normalizeError(error));
      });
  });
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const keycloakRef = useRef<KeycloakInstance | null>(
    authConfig
      ? new Keycloak({
          url: authConfig.url,
          realm: authConfig.realm,
          clientId: authConfig.publicClientId,
        })
      : null,
  );
  const hasInitializedRef = useRef(false);

  const [state, setState] = useState<Omit<AuthContextValue, "login" | "logout" | "refresh">>(
    () => ({
      isEnabled: keycloakRef.current !== null,
      isLoading: false,
      isReady: keycloakRef.current === null,
      isAuthenticated: false,
      profile: null,
      token: null,
      tokenParsed: undefined,
    }),
  );

  useEffect(() => {
    const keycloak = keycloakRef.current;
    if (!keycloak || hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    let isMounted = true;

    setState((prev) => ({
      ...prev,
      isEnabled: keycloakRef.current !== null,
      isLoading: true,
      isReady: false,
    }));

    const initPromise = keycloak.init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      enableLogging: false,
      silentCheckSsoRedirectUri: SILENT_CHECK_URI,
      checkLoginIframe: true,
      flow: "standard",
    });

    withTimeout(initPromise, KEYCLOAK_INIT_TIMEOUT_MS, () => {
      console.warn("Keycloak initialization timed out; disabling auth");
    })
      .then(async (authenticated) => {
        if (!isMounted) {
          return;
        }

        if (!authenticated) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isReady: true,
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
            isReady: true,
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
            isReady: true,
            isAuthenticated: true,
            profile: null,
            token: keycloak.token ?? null,
            tokenParsed: keycloak.tokenParsed,
          }));
        }
      })
      .catch((error) => {
        console.error("Keycloak initialization failed", error);
        keycloakRef.current = null;
        hasInitializedRef.current = false;
        if (!isMounted) {
          return;
        }
        setState((prev) => ({
          ...prev,
          isEnabled: false,
          isLoading: false,
          isReady: true,
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

    const refreshInterval = keycloak ? window.setInterval(refreshToken, 2 * 60 * 1000) : null;

    return () => {
      isMounted = false;
      if (refreshInterval !== null) {
        window.clearInterval(refreshInterval);
      }
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
