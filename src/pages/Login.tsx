import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

type TurnstileTheme = "light" | "dark" | "auto";

interface TurnstileRenderOptions {
  sitekey: string;
  size?: "invisible" | "normal" | "compact";
  action?: string;
  theme?: TurnstileTheme;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "timeout-callback"?: () => void;
}

interface TurnstileInstance {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  execute: (widgetId: string, options?: { action?: string }) => void;
  getResponse?: (widgetId: string) => string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

const TURNSTILE_ACTION = "login";
const MAX_FAILED_ATTEMPTS = 3;
const COOL_DOWN_MS = 15_000;

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const failedAttemptsRef = useRef(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileResolveRef = useRef<((token: string) => void) | null>(null);
  const turnstileRejectRef = useRef<((error: Error) => void) | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const validateEmail = (value: string) => /.+@.+\..+/i.test(value.trim());

  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";
  const turnstileConfigured = turnstileSiteKey.length > 0;

  useEffect(() => {
    if (!turnstileConfigured) {
      setTurnstileReady(false);
      setTurnstileError(null);
      return;
    }

    setTurnstileReady(false);
    let isMounted = true;

    const cleanupWidget = () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch (error) {
          console.warn("Failed to cleanup Turnstile widget", error);
        }
        turnstileWidgetIdRef.current = null;
      }
    };

    const renderWidget = () => {
      if (!isMounted || !turnstileContainerRef.current || !window.turnstile) {
        return;
      }

      cleanupWidget();
      turnstileContainerRef.current.innerHTML = "";

      try {
        const widgetId = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          size: "invisible",
          action: TURNSTILE_ACTION,
          callback: (token) => {
            if (turnstileResolveRef.current) {
              turnstileResolveRef.current(token);
            }
          },
          "error-callback": () => {
            setTurnstileError(t("login_captcha_failed"));
            if (turnstileRejectRef.current) {
              turnstileRejectRef.current(new Error("turnstile-error"));
            }
          },
          "timeout-callback": () => {
            setTurnstileError(t("login_captcha_failed"));
            if (turnstileRejectRef.current) {
              turnstileRejectRef.current(new Error("turnstile-timeout"));
            }
          },
        });
        turnstileWidgetIdRef.current = widgetId;
        setTurnstileReady(true);
        setTurnstileError(null);
      } catch (error) {
        console.error("Unable to render Turnstile widget", error);
        setTurnstileError(t("login_captcha_failed"));
      }
    };

    const handleScriptError = () => {
      if (!isMounted) {
        return;
      }
      setTurnstileReady(false);
      setTurnstileError(t("login_captcha_unavailable"));
    };

    const ensureScript = () => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (existing) {
        if (window.turnstile) {
          renderWidget();
        } else {
          existing.addEventListener("load", renderWidget, { once: true });
          existing.addEventListener("error", handleScriptError, { once: true });
        }
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", handleScriptError);
      document.head.appendChild(script);
    };

    ensureScript();

    return () => {
      isMounted = false;
      cleanupWidget();
    };
  }, [t, turnstileConfigured, turnstileSiteKey]);

  useEffect(() => {
    if (cooldownUntil === null) {
      return;
    }

    const now = Date.now();
    if (cooldownUntil <= now) {
      setCooldownUntil(null);
      failedAttemptsRef.current = 0;
      return;
    }

    const timer = window.setInterval(() => {
      forceTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const executeTurnstile = useCallback((): Promise<string> => {
    if (!turnstileConfigured) {
      return Promise.resolve("mock-success");
    }

    const widgetId = turnstileWidgetIdRef.current;
    const turnstile = window.turnstile;

    if (!widgetId || !turnstile) {
      return Promise.reject(new Error("turnstile-not-ready"));
    }

    const existingResponse = turnstile.getResponse?.(widgetId);
    if (typeof existingResponse === "string" && existingResponse.length > 0) {
      try {
        turnstile.reset(widgetId);
      } catch (error) {
        console.warn("Turnstile reset failed before execute", error);
      }
    }

    return new Promise<string>((resolve, reject) => {
      turnstileResolveRef.current = resolve;
      turnstileRejectRef.current = reject;

      try {
        turnstile.execute(widgetId, { action: TURNSTILE_ACTION });
      } catch (error) {
        turnstileResolveRef.current = null;
        turnstileRejectRef.current = null;
        reject(error instanceof Error ? error : new Error("turnstile-execute-failed"));
      }
    });
  }, [turnstileConfigured]);

  const isCoolingDown = useMemo(() => {
    if (cooldownUntil === null) {
      return false;
    }
    return cooldownUntil > Date.now();
  }, [cooldownUntil]);

  const cooldownSeconds = useMemo(() => {
    if (!isCoolingDown || cooldownUntil === null) {
      return 0;
    }
    return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  }, [cooldownUntil, isCoolingDown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setTurnstileError(null);

    const trimmedEmail = email.trim();

    if (!validateEmail(trimmedEmail)) {
      setError(t("login_invalid_email"));
      return;
    }

    if (password.trim().length < 8) {
      setError(t("login_invalid_password"));
      return;
    }

    if (isCoolingDown) {
      setError(t("login_cooldown", { seconds: cooldownSeconds }));
      return;
    }

    if (turnstileConfigured && !turnstileReady) {
      setError(t("login_captcha_unavailable"));
      return;
    }

    setIsSubmitting(true);

    try {
      const captchaToken = await executeTurnstile();
      await auth.login({ email: trimmedEmail, password, captchaToken });
      failedAttemptsRef.current = 0;
      setCooldownUntil(null);
      void navigate(from, { replace: true });
    } catch (loginError) {
      const message =
        loginError instanceof Error && loginError.message.toLowerCase().includes("invalid")
          ? t("login_invalid_credentials")
          : t("login_generic_error");
      setError(message);
      setPassword("");

      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        } catch (error) {
          console.warn("Turnstile reset failed", error);
        }
      }

      const next = failedAttemptsRef.current + 1;
      failedAttemptsRef.current = next;
      if (next >= MAX_FAILED_ATTEMPTS) {
        setCooldownUntil(Date.now() + COOL_DOWN_MS);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md border border-border/60">
        <CardHeader className="space-y-2 text-center">
          <CardTitle>{t("login_title")}</CardTitle>
          <CardDescription>{t("login_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="login-email">{t("login_email_label")}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">{t("login_password_label")}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {isCoolingDown && (
              <p className="text-sm text-muted-foreground">
                {t("login_cooldown", { seconds: cooldownSeconds })}
              </p>
            )}

            {turnstileConfigured ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t(turnstileReady ? "login_captcha_ready" : "login_captcha_loading")}
                {turnstileError ? <span className="ml-2 text-destructive">{turnstileError}</span> : null}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                {t("login_captcha_disabled")}
              </div>
            )}

            <div ref={turnstileContainerRef} className="hidden" aria-hidden="true" />

            <Button
              className="w-full"
              type="submit"
              disabled={isSubmitting || auth.isLoading || isCoolingDown}
            >
              {isSubmitting || auth.isLoading ? t("login_processing") : t("login_submit")}
            </Button>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={(event) => event.preventDefault()}
              >
                {t("login_forgot_password")}
              </button>
              <Link
                to="/register"
                className="text-primary underline-offset-4 hover:underline"
              >
                {t("login_create_account")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
