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
import { useTranslation } from "react-i18next";
import { jwtDecode, type JwtPayload } from "jwt-decode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, configureApiClient } from "@/lib/api-client";
import { getKeycloakEnvConfig } from "@/lib/env";

const SESSION_STORAGE_KEY = "argus.portal.auth";
const STORAGE_BROADCAST_KEY = "argus.portal.auth.event";
const REFRESH_LEEWAY_MS = 60_000;
const REFRESH_JITTER_MS = 15_000;
const REFRESH_MIN_DELAY_MS = 5_000;
const VISIBILITY_PAUSE_THRESHOLD_MS = 10 * 60_000;
const INACTIVITY_LIMIT_MS = 30 * 60_000;
const INACTIVITY_WARNING_MS = 60_000;

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

interface AuthBroadcastTokensMessage {
  type: "tokens";
  sourceId: string;
  tokens: StoredTokens;
}

interface AuthBroadcastLogoutMessage {
  type: "logout";
  sourceId: string;
}

type AuthBroadcastMessage = AuthBroadcastTokensMessage | AuthBroadcastLogoutMessage;

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

interface LogoutOptions {
  redirect: boolean;
  broadcast: boolean;
  callBackend: boolean;
  reason: string;
}

const isBrowser = typeof window !== "undefined";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeSessionStorageGetItem(key: string): string | null {
  if (!isBrowser) {
    return null;
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.warn("Unable to read from sessionStorage", error);
    return null;
  }
}

function safeSessionStorageSetItem(key: string, value: string): void {
  if (!isBrowser) {
    return;
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    console.warn("Unable to persist sessionStorage value", error);
  }
}

function safeSessionStorageRemoveItem(key: string): void {
  if (!isBrowser) {
    return;
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn("Unable to remove sessionStorage value", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const authConfig = getKeycloakEnvConfig();
  const isAuthConfigured = Boolean(authConfig);
  const navigate = useNavigate();

  const sessionIdRef = useRef<string>(generateSessionId());
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const tokenTypeRef = useRef<string>("Bearer");
  const latestTokensRef = useRef<StoredTokens | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshPausedRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const visibilityPauseTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityWarningTimerRef = useRef<number | null>(null);
  const inactivityLogoutTimerRef = useRef<number | null>(null);
  const logoutInFlightRef = useRef<Promise<void> | null>(null);
  const refreshExecutorRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const isAuthenticatedRef = useRef(false);

  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

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

  const clearVisibilityPauseTimer = useCallback(() => {
    if (visibilityPauseTimerRef.current !== null) {
      window.clearTimeout(visibilityPauseTimerRef.current);
      visibilityPauseTimerRef.current = null;
    }
    refreshPausedRef.current = false;
  }, []);

  const clearInactivityTimers = useCallback(() => {
    if (inactivityWarningTimerRef.current !== null) {
      window.clearTimeout(inactivityWarningTimerRef.current);
      inactivityWarningTimerRef.current = null;
    }
    if (inactivityLogoutTimerRef.current !== null) {
      window.clearTimeout(inactivityLogoutTimerRef.current);
      inactivityLogoutTimerRef.current = null;
    }
  }, []);

  const storeTokens = useCallback((tokens: StoredTokens) => {
    safeSessionStorageSetItem(SESSION_STORAGE_KEY, JSON.stringify(tokens));
  }, []);

  const removeStoredTokens = useCallback(() => {
    safeSessionStorageRemoveItem(SESSION_STORAGE_KEY);
  }, []);

  const broadcastSession = useCallback(
    (message: AuthBroadcastMessage) => {
      if (!isBrowser) {
        return;
      }
      try {
        const payload = JSON.stringify({ ...message, sourceId: sessionIdRef.current });
        window.localStorage.setItem(STORAGE_BROADCAST_KEY, payload);
        window.localStorage.removeItem(STORAGE_BROADCAST_KEY);
      } catch (error) {
        console.warn("Unable to broadcast auth event", error);
      }
    },
    [],
  );

  const finalizeLogout = useCallback(
    ({ redirect, broadcast }: { redirect: boolean; broadcast: boolean }) => {
      clearRefreshTimer();
      clearInactivityTimers();
      clearVisibilityPauseTimer();
      setShowInactivityWarning(false);

      accessTokenRef.current = null;
      refreshTokenRef.current = null;
      tokenTypeRef.current = "Bearer";
      latestTokensRef.current = null;
      isAuthenticatedRef.current = false;
      removeStoredTokens();

      setState({
        isEnabled: isAuthConfigured,
        isLoading: false,
        isReady: true,
        isAuthenticated: false,
        profile: null,
        token: null,
      });

      if (broadcast) {
        broadcastSession({ type: "logout", sourceId: sessionIdRef.current });
      }

      if (redirect) {
        void navigate("/auth/login", { replace: true });
      }
    },
    [broadcastSession, clearInactivityTimers, clearRefreshTimer, clearVisibilityPauseTimer, isAuthConfigured, navigate, removeStoredTokens],
  );

  const performLogout = useCallback(
    async ({ redirect, broadcast, callBackend, reason }: LogoutOptions) => {
      if (logoutInFlightRef.current) {
        await logoutInFlightRef.current;
        return;
      }

      const task = (async () => {
        const refreshToken = refreshTokenRef.current;
        if (callBackend && refreshToken) {
          try {
            const response = await apiFetch(
              "/api/auth/logout",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ refreshToken }),
              },
              { skipAuth: true },
            );

            if (!response.ok && response.status !== 401) {
              const message = await response.text();
              console.warn("Backend logout failed:", message || response.statusText);
            }
          } catch (error) {
            console.warn("Logout request failed", error);
          }
        }

        finalizeLogout({ redirect, broadcast });
        console.info("[Auth] Session terminated", { reason });
      })();

      logoutInFlightRef.current = task;
      try {
        await task;
      } finally {
        logoutInFlightRef.current = null;
      }
    },
    [finalizeLogout],
  );

  const scheduleInactivityTimers = useCallback(() => {
    clearInactivityTimers();
    if (!isAuthenticatedRef.current) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastActivityRef.current;
    const remaining = INACTIVITY_LIMIT_MS - elapsed;

    if (remaining <= 0) {
      void performLogout({
        redirect: true,
        broadcast: true,
        callBackend: true,
        reason: "inactivity-timeout",
      });
      return;
    }

    if (remaining <= INACTIVITY_WARNING_MS) {
      setShowInactivityWarning(true);
      inactivityLogoutTimerRef.current = window.setTimeout(() => {
        void performLogout({
          redirect: true,
          broadcast: true,
          callBackend: true,
          reason: "inactivity-timeout",
        });
      }, remaining);
      return;
    }

    inactivityWarningTimerRef.current = window.setTimeout(() => {
      setShowInactivityWarning(true);
    }, remaining - INACTIVITY_WARNING_MS);

    inactivityLogoutTimerRef.current = window.setTimeout(() => {
      void performLogout({
        redirect: true,
        broadcast: true,
        callBackend: true,
        reason: "inactivity-timeout",
      });
    }, remaining);
  }, [clearInactivityTimers, performLogout]);

  const recordActivity = useCallback(() => {
    if (!isAuthenticatedRef.current) {
      return;
    }
    lastActivityRef.current = Date.now();
    setShowInactivityWarning((open) => (open ? false : open));
    scheduleInactivityTimers();
  }, [scheduleInactivityTimers]);

  const forceRefresh = useCallback(async (): Promise<boolean> => {
    const executor = refreshExecutorRef.current;
    const success = await executor();
    if (!success) {
      await performLogout({
        redirect: true,
        broadcast: true,
        callBackend: true,
        reason: "refresh-failed",
      });
    }
    return success;
  }, [performLogout]);

  const scheduleRefresh = useCallback(
    (tokens: StoredTokens) => {
      latestTokensRef.current = tokens;
      if (refreshPausedRef.current) {
        return;
      }

      clearRefreshTimer();

      const now = Date.now();
      const timeUntilExpiry = tokens.expiresAt - now;

      const trigger = () => {
        void forceRefresh();
      };

      if (timeUntilExpiry <= REFRESH_LEEWAY_MS) {
        refreshTimerRef.current = window.setTimeout(trigger, 0);
        return;
      }

      const jitter = (Math.random() * 2 - 1) * REFRESH_JITTER_MS;
      const delay = Math.max(timeUntilExpiry - REFRESH_LEEWAY_MS + jitter, REFRESH_MIN_DELAY_MS);
      refreshTimerRef.current = window.setTimeout(trigger, delay);
    },
    [clearRefreshTimer, forceRefresh],
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
    (tokens: StoredTokens, options: { broadcast?: boolean } = {}) => {
      const profile = decodeProfile(tokens.accessToken);
      if (!profile) {
        throw new Error("Unable to decode access token");
      }

      if (tokens.refreshExpiresAt && tokens.refreshExpiresAt <= Date.now()) {
        throw new Error("Refresh token expired");
      }

      accessTokenRef.current = tokens.accessToken;
      refreshTokenRef.current = tokens.refreshToken;
      tokenTypeRef.current = tokens.tokenType || "Bearer";
      latestTokensRef.current = tokens;
      isAuthenticatedRef.current = true;

      storeTokens(tokens);

      setState({
        isEnabled: isAuthConfigured,
        isLoading: false,
        isReady: true,
        isAuthenticated: true,
        profile,
        token: tokens.accessToken,
      });

      if (options.broadcast !== false) {
        broadcastSession({ type: "tokens", sourceId: sessionIdRef.current, tokens });
      }

      recordActivity();
      scheduleRefresh(tokens);
    },
    [broadcastSession, decodeProfile, isAuthConfigured, recordActivity, scheduleRefresh, storeTokens],
  );

  const normalizeTokens = useCallback((response: AuthApiResponse): StoredTokens => {
    const now = Date.now();
    const expiresAt = now + response.expiresIn * 1000;
    const refreshExpiresAt = response.refreshExpiresIn
      ? now + response.refreshExpiresIn * 1000
      : undefined;

    return {
      tokenType: response.tokenType?.trim() || "Bearer",
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt,
      refreshExpiresAt,
    };
  }, []);

  const applyResponse = useCallback(
    (response: AuthApiResponse, options: { broadcast?: boolean } = {}) => {
      const tokens = normalizeTokens(response);
      applyTokens(tokens, options);
    },
    [applyTokens, normalizeTokens],
  );

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!refreshTokenRef.current) {
      return false;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const task = (async () => {
      try {
        const response = await apiFetch(
          "/api/auth/refresh",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
          },
          { skipAuth: true },
        );

        if (response.status === 401) {
          return false;
        }

        if (!response.ok) {
          const message = await response.text();
          console.error("Token refresh failed", message || response.statusText);
          return false;
        }

        const data = (await response.json()) as AuthApiResponse;
        applyResponse(data);
        return true;
      } catch (error) {
        console.error("Token refresh request failed", error);
        return false;
      }
    })();

    refreshInFlightRef.current = task;
    try {
      return await task;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [applyResponse]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      if (!isAuthConfigured) {
        throw new Error("Authentication is not configured");
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const body: Record<string, unknown> = {
          email: credentials.email,
          password: credentials.password,
        };

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
      void performLogout({
        redirect,
        broadcast: true,
        callBackend: true,
        reason: "manual",
      });
    },
    [performLogout],
  );

  const handleStayLoggedIn = useCallback(() => {
    setShowInactivityWarning(false);
    recordActivity();
    void forceRefresh();
  }, [forceRefresh, recordActivity]);

  const handleLogoutNow = useCallback(() => {
    setShowInactivityWarning(false);
    void performLogout({
      redirect: true,
      broadcast: true,
      callBackend: true,
      reason: "inactivity-user",
    });
  }, [performLogout]);

  useEffect(() => {
    if (!isAuthConfigured) {
      setState((prev) => ({ ...prev, isReady: true }));
      return;
    }

    const raw = safeSessionStorageGetItem(SESSION_STORAGE_KEY);
    if (!raw) {
      setState((prev) => ({ ...prev, isReady: true }));
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredTokens;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) {
        throw new Error("Stored tokens incomplete");
      }

      applyTokens(parsed, { broadcast: false });

      if (parsed.expiresAt - Date.now() <= REFRESH_LEEWAY_MS) {
        void forceRefresh();
      }
    } catch (error) {
      console.error("Failed to restore session", error);
      removeStoredTokens();
      setState((prev) => ({ ...prev, isReady: true }));
    }
  }, [applyTokens, forceRefresh, isAuthConfigured, removeStoredTokens]);

  useEffect(() => {
    refreshExecutorRef.current = refreshTokens;
  }, [refreshTokens]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_BROADCAST_KEY || event.newValue === null) {
        return;
      }

      if (event.storageArea !== window.localStorage) {
        return;
      }

      try {
        const message = JSON.parse(event.newValue) as AuthBroadcastMessage;
        if (message.sourceId === sessionIdRef.current) {
          return;
        }

        if (message.type === "tokens") {
          applyTokens(message.tokens, { broadcast: false });
        } else if (message.type === "logout") {
          void performLogout({
            redirect: true,
            broadcast: false,
            callBackend: false,
            reason: "remote-logout",
          });
        }
      } catch (error) {
        console.warn("Unable to process auth storage event", error);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyTokens, performLogout]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const handleVisibilityChange = () => {
      if (!isAuthenticatedRef.current) {
        return;
      }

      if (document.visibilityState === "hidden") {
        visibilityPauseTimerRef.current ??= window.setTimeout(() => {
          refreshPausedRef.current = true;
          clearRefreshTimer();
        }, VISIBILITY_PAUSE_THRESHOLD_MS);
      } else {
        clearVisibilityPauseTimer();
        if (refreshPausedRef.current) {
          refreshPausedRef.current = false;
          const tokens = latestTokensRef.current;
          if (tokens) {
            if (tokens.expiresAt - Date.now() <= REFRESH_LEEWAY_MS) {
              void forceRefresh();
            } else {
              scheduleRefresh(tokens);
            }
          }
        }
        recordActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearRefreshTimer, clearVisibilityPauseTimer, forceRefresh, recordActivity, scheduleRefresh]);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const handleUserEvent = () => {
      recordActivity();
    };

    window.addEventListener("click", handleUserEvent, true);
    window.addEventListener("keydown", handleUserEvent, true);

    return () => {
      window.removeEventListener("click", handleUserEvent, true);
      window.removeEventListener("keydown", handleUserEvent, true);
    };
  }, [recordActivity]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => {
        const token = accessTokenRef.current;
        if (!token) {
          return null;
        }
        const type = tokenTypeRef.current ?? "Bearer";
        return `${type} ${token}`;
      },
      tryRefresh: refreshTokens,
      onUnauthorized: () => {
        void performLogout({
          redirect: true,
          broadcast: true,
          callBackend: true,
          reason: "unauthorized",
        });
      },
      onRequestSuccess: () => {
        recordActivity();
      },
    });
  }, [performLogout, recordActivity, refreshTokens]);

  const contextValue = useMemo<AuthContextValue>(() => {
    return {
      ...state,
      login,
      logout,
    };
  }, [login, logout, state]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      <Dialog
        open={showInactivityWarning}
        onOpenChange={(open) => {
          if (!open) {
            setShowInactivityWarning(false);
            recordActivity();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("session_timeout_title", { defaultValue: "Session will expire soon" })}</DialogTitle>
            <DialogDescription>
              {t("session_timeout_message", {
                defaultValue: "You have been inactive for a while. Choose “Stay logged in” to continue your session.",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleStayLoggedIn}>
              {t("session_timeout_extend", { defaultValue: "Stay logged in" })}
            </Button>
            <Button variant="destructive" onClick={handleLogoutNow}>
              {t("session_timeout_logout", { defaultValue: "Log out" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
