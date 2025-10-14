import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode, type JwtPayload } from "jwt-decode";

import { apiFetch, configureApiClient } from "@/lib/api-client";
import { getKeycloakEnvConfig } from "@/lib/env";

interface TokenClaims extends JwtPayload {
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
}

interface AuthProfile {
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface StoredTokens {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt?: number;
}

interface AuthApiResponse {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  captchaToken?: string;
}

interface AuthContextValue {
  isEnabled: boolean;
  isLoading: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  profile: AuthProfile | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: (redirect?: boolean) => void;
}

const SESSION_STORAGE_KEY = "argus.portal.auth";
const REFRESH_LEEWAY_MS = 60_000; // refresh 60s before expiry

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const authConfig = getKeycloakEnvConfig();
  const isAuthConfigured = Boolean(authConfig);

  const navigate = useNavigate();

  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshTokensRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const [state, setState] = useState<Omit<AuthContextValue, "login" | "logout">>(() => ({
    isEnabled: isAuthConfigured,
    isLoading: false,
    isReady: !isAuthConfigured,
    isAuthenticated: false,
    profile: null,
    token: null,
  }));

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const storeTokens = useCallback((tokens: StoredTokens) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tokens));
  }, []);

  const removeStoredTokens = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const scheduleRefresh = useCallback(
    (tokens: StoredTokens) => {
      clearRefreshTimer();
      const now = Date.now();
      const delay = Math.max(tokens.expiresAt - now - REFRESH_LEEWAY_MS, 0);
      refreshTimerRef.current = window.setTimeout(() => {
        void refreshTokensRef.current();
      }, delay);
    },
    [clearRefreshTimer],
  );

  const decodeProfile = useCallback((token: string): AuthProfile | null => {
    try {
      const claims = jwtDecode<TokenClaims>(token);
      const username =
        claims.preferred_username ??
        claims.email ??
        claims.name ??
        claims.sub ??
        null;

      return {
        username,
        email: claims.email ?? null,
        firstName: claims.given_name ?? null,
        lastName: claims.family_name ?? null,
      };
    } catch (error) {
      console.error("Failed to decode access token", error);
      return null;
    }
  }, []);

  const applyTokens = useCallback(
    (tokens: StoredTokens) => {
      const profile = decodeProfile(tokens.accessToken);
      if (!profile) {
        throw new Error("Unable to decode profile from access token");
      }

      accessTokenRef.current = tokens.accessToken;
      refreshTokenRef.current = tokens.refreshToken;
      storeTokens(tokens);
      scheduleRefresh(tokens);

      setState({
        isEnabled: isAuthConfigured,
        isLoading: false,
        isReady: true,
        isAuthenticated: true,
        profile,
        token: tokens.accessToken,
      });
    },
    [decodeProfile, isAuthConfigured, scheduleRefresh, storeTokens],
  );

  const normalizeTokens = useCallback(
    (response: AuthApiResponse): StoredTokens => {
      const now = Date.now();
      const expiresAt = now + response.expiresIn * 1000;
      const refreshExpiresAt = response.refreshExpiresIn
        ? now + response.refreshExpiresIn * 1000
        : undefined;

      return {
        tokenType: response.tokenType || "Bearer",
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt,
        refreshExpiresAt,
      };
    },
    [],
  );

  const performLogout = useCallback(
    (redirect: boolean) => {
      clearRefreshTimer();
      accessTokenRef.current = null;
      refreshTokenRef.current = null;
      removeStoredTokens();

      setState({
        isEnabled: isAuthConfigured,
        isLoading: false,
        isReady: true,
        isAuthenticated: false,
        profile: null,
        token: null,
      });

      if (redirect) {
        void navigate("/auth/login", { replace: true });
      }
    },
    [clearRefreshTimer, isAuthConfigured, navigate, removeStoredTokens],
  );

  const applyResponse = useCallback(
    (response: AuthApiResponse) => {
      const tokens = normalizeTokens(response);
      applyTokens(tokens);
    },
    [applyTokens, normalizeTokens],
  );

  const refreshTokens = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    if (!refreshToken) {
      performLogout(true);
      return;
    }

    try {
      const response = await apiFetch(
        "/api/auth/refresh",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        },
        { skipAuth: true },
      );

      if (response.status === 401) {
        throw new Error("Refresh token invalid");
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to refresh token");
      }

      const data = (await response.json()) as AuthApiResponse;
      applyResponse(data);
    } catch (error) {
      console.error("Token refresh failed", error);
      performLogout(true);
    }
  }, [applyResponse, performLogout]);

  refreshTokensRef.current = refreshTokens;

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      onUnauthorized: () => performLogout(true),
    });
  }, [performLogout]);

  useEffect(() => {
    if (!isAuthConfigured) {
      setState((prev) => ({ ...prev, isReady: true }));
      return;
    }

    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      setState((prev) => ({ ...prev, isReady: true }));
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredTokens;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) {
        throw new Error("Stored tokens incomplete");
      }

      applyTokens(parsed);

      if (parsed.expiresAt <= Date.now()) {
        void refreshTokens();
      }
    } catch (error) {
      console.error("Failed to restore session", error);
      performLogout(false);
    }
  }, [applyTokens, isAuthConfigured, performLogout, refreshTokens]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const { email, password } = credentials;
      if (!isAuthConfigured) {
        throw new Error("Authentication is not configured");
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const body: Record<string, unknown> = { email, password };
        if (typeof credentials.captchaToken === "string") {
          body.captchaToken = credentials.captchaToken;
        }

        const response = await apiFetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
          { skipAuth: true },
        );

        if (response.status === 401) {
          throw new Error("Invalid email or password");
        }

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Unable to sign in");
        }

        const data = (await response.json()) as AuthApiResponse;
        applyResponse(data);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [applyResponse, isAuthConfigured],
  );

  const logout = useCallback(
    (redirect = true) => {
      performLogout(redirect);
    },
    [performLogout],
  );

  const contextValue = useMemo<AuthContextValue>(() => {
    return {
      ...state,
      login,
      logout,
    };
  }, [login, logout, state]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
