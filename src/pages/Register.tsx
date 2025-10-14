import type { ChangeEvent, FormEvent, JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { Apple, Check, Chrome, Facebook, Github, Instagram, Music4, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { getKeycloakEnvConfig } from "@/lib/env";

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

type PasswordCheck = "length" | "letter" | "number" | "symbol" | "spaces";

const REQUIRED_CHECKS: PasswordCheck[] = ["length", "letter", "number", "symbol"];
const PASSWORD_CHECKS: PasswordCheck[] = [...REQUIRED_CHECKS, "spaces"];
const TIME_GATE_MS = 1500;
const SUBMIT_THROTTLE_MS = 5000;
const TURNSTILE_ACTION = "register";

interface PasswordAnalysis {
  score: number;
  labelKey: string;
  colorClass: string;
  checks: Record<PasswordCheck, boolean>;
  mandatoryPassed: boolean;
}

interface SocialProvider {
  id: string;
  brokerPath: string;
  translationKey: string;
  icon: (props: { className?: string; color: string }) => JSX.Element;
  lightColor: string;
  darkColor: string;
  lightBackground: string;
  darkBackground: string;
}

const COUNTRIES = [
  { code: "UA", labelKey: "register_country_ua" },
  { code: "PL", labelKey: "register_country_pl" },
  { code: "DE", labelKey: "register_country_de" },
  { code: "US", labelKey: "register_country_us" },
  { code: "GB", labelKey: "register_country_gb" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function MicrosoftGlyph({ className, color }: { className?: string; color: string }): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="8" height="8" fill={color} rx="1.5" />
      <rect x="13" y="3" width="8" height="8" fill={color} opacity="0.7" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" fill={color} opacity="0.85" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" fill={color} opacity="0.55" rx="1.5" />
    </svg>
  );
}

const SOCIAL_PROVIDERS: readonly SocialProvider[] = [
  {
    id: "google",
    brokerPath: "google",
    translationKey: "register_social_google",
    icon: ({ className, color }) => <Chrome className={className} color={color} />,
    lightColor: "#4285F4",
    darkColor: "#F5F5F5",
    lightBackground: "#E8F0FE",
    darkBackground: "rgba(255,255,255,0.08)",
  },
  {
    id: "github",
    brokerPath: "github",
    translationKey: "register_social_github",
    icon: ({ className, color }) => <Github className={className} color={color} />,
    lightColor: "#0A0A0A",
    darkColor: "#F5F5F5",
    lightBackground: "#F1F1F1",
    darkBackground: "rgba(255,255,255,0.08)",
  },
  {
    id: "microsoft",
    brokerPath: "microsoft",
    translationKey: "register_social_microsoft",
    icon: ({ className, color }) => <MicrosoftGlyph className={className} color={color} />,
    lightColor: "#00A4EF",
    darkColor: "#F5F5F5",
    lightBackground: "#E5F3FF",
    darkBackground: "rgba(255,255,255,0.08)",
  },
  {
    id: "apple",
    brokerPath: "apple",
    translationKey: "register_social_apple",
    icon: ({ className, color }) => <Apple className={className} color={color} />,
    lightColor: "#0F0F0F",
    darkColor: "#F5F5F5",
    lightBackground: "#F5F5F7",
    darkBackground: "rgba(255,255,255,0.08)",
  },
  {
    id: "facebook",
    brokerPath: "facebook",
    translationKey: "register_social_facebook",
    icon: ({ className, color }) => <Facebook className={className} color={color} />,
    lightColor: "#1877F2",
    darkColor: "#F5F5F5",
    lightBackground: "#E8F0FF",
    darkBackground: "rgba(255,255,255,0.08)",
  },
  {
    id: "instagram",
    brokerPath: "instagram",
    translationKey: "register_social_instagram",
    icon: ({ className, color }) => <Instagram className={className} color={color} />,
    lightColor: "#E4405F",
    darkColor: "#F5F5F5",
    lightBackground: "#FFE9EE",
    darkBackground: "rgba(255,255,255,0.08)",
  },
  {
    id: "tiktok",
    brokerPath: "tiktok",
    translationKey: "register_social_tiktok",
    icon: ({ className, color }) => <Music4 className={className} color={color} />,
    lightColor: "#FE2C55",
    darkColor: "#F5F5F5",
    lightBackground: "#FFE6EC",
    darkBackground: "rgba(255,255,255,0.08)",
  },
] as const;

function analysePassword(password: string): PasswordAnalysis {
  const sanitized = password.trim();
  const checks: Record<PasswordCheck, boolean> = {
    length: sanitized.length >= 8,
    letter: /[A-Za-z]/.test(sanitized),
    number: /\d/.test(sanitized),
    symbol: /[^A-Za-z0-9]/.test(sanitized),
    spaces: !/\s/.test(password),
  };

  const passedChecks = PASSWORD_CHECKS.filter((key) => checks[key]).length;
  const mandatoryPassed = REQUIRED_CHECKS.every((key) => checks[key]);

  let labelKey = "register_strength_weak";
  let colorClass = "bg-destructive";
  if (passedChecks >= PASSWORD_CHECKS.length) {
    labelKey = "register_strength_excellent";
    colorClass = "bg-emerald-500";
  } else if (passedChecks >= PASSWORD_CHECKS.length - 1) {
    labelKey = "register_strength_strong";
    colorClass = "bg-green-500";
  } else if (passedChecks >= PASSWORD_CHECKS.length - 2) {
    labelKey = "register_strength_good";
    colorClass = "bg-lime-500";
  } else if (passedChecks >= PASSWORD_CHECKS.length - 3) {
    labelKey = "register_strength_fair";
    colorClass = "bg-amber-500";
  }

  return {
    score: passedChecks,
    labelKey,
    colorClass,
    checks,
    mandatoryPassed,
  };
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0);

  if (tokens.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: "" };
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(" "),
  };
}

export function RegisterPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { resolved: resolvedTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securityBlockKey, setSecurityBlockKey] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isTimeGateOpen, setIsTimeGateOpen] = useState(false);
  const [throttleUntil, setThrottleUntil] = useState<number>(0);

  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";
  const turnstileVerifyUrl =
    (import.meta.env.VITE_TURNSTILE_VERIFY_URL as string | undefined)?.trim() ?? "";
  const rawBackendBaseUrl =
    (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() ?? "";
  const backendBaseUrl = rawBackendBaseUrl.length > 0 ? rawBackendBaseUrl : "http://127.0.0.1:8000";
  const keycloakConfig = getKeycloakEnvConfig();
  const turnstileConfigured = turnstileSiteKey.length > 0;

  const formMountedAtRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  const fieldCompletionTimesRef = useRef<number[]>([]);
  const redirectTimerRef = useRef<number | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileResolveRef = useRef<((token: string) => void) | null>(null);
  const turnstileRejectRef = useRef<((error: Error) => void) | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsTimeGateOpen(true), TIME_GATE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!turnstileConfigured) {
      setTurnstileReady(false);
      setTurnstileError(null);
      return;
    }

    setTurnstileReady(false);
    let isMounted = true;

    const cleanupWidget = () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };

    const handleRender = () => {
      if (!isMounted || !turnstileContainerRef.current || !window.turnstile) {
        if (turnstileWidgetIdRef.current && window.turnstile) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        return;
      }

      cleanupWidget();
      turnstileContainerRef.current.innerHTML = "";

      const widgetId = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        size: "invisible",
        action: TURNSTILE_ACTION,
        theme: resolvedTheme as TurnstileTheme,
        callback: (token: string) => {
          setTurnstileError(null);
          turnstileResolveRef.current?.(token);
          turnstileResolveRef.current = null;
          turnstileRejectRef.current = null;
        },
        "error-callback": () => {
          const error = new Error("turnstile-error");
          setTurnstileError(t("register_turnstile_failed"));
          turnstileRejectRef.current?.(error);
          turnstileResolveRef.current = null;
          turnstileRejectRef.current = null;
        },
        "timeout-callback": () => {
          const error = new Error("turnstile-timeout");
          setTurnstileError(t("register_turnstile_failed"));
          turnstileRejectRef.current?.(error);
          turnstileResolveRef.current = null;
          turnstileRejectRef.current = null;
        },
      });

      turnstileWidgetIdRef.current = widgetId;
      if (isMounted) {
        setTurnstileReady(true);
      }
    };

    const handleScriptError = () => {
      if (!isMounted) {
        return;
      }
      setTurnstileReady(false);
      setTurnstileError(t("register_turnstile_unavailable"));
    };

    const ensureScript = () => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (existing) {
        if (window.turnstile) {
          handleRender();
        } else {
          existing.addEventListener("load", handleRender, { once: true });
          existing.addEventListener("error", handleScriptError, { once: true });
        }
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      script.addEventListener("load", handleRender);
      script.addEventListener("error", handleScriptError);
      document.head.appendChild(script);
    };

    ensureScript();

    return () => {
      isMounted = false;
      cleanupWidget();
    };
  }, [resolvedTheme, t, turnstileConfigured, turnstileSiteKey]);

  const detectRapidFill = useCallback(
    (previousValue: string, nextValue: string) => {
      if (securityBlockKey) {
        return;
      }

      const wasEmpty = previousValue.trim().length === 0;
      const nowFilled = nextValue.trim().length > 0;

      if (!wasEmpty || !nowFilled) {
        return;
      }

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const lastTime =
        fieldCompletionTimesRef.current.length > 0
          ? fieldCompletionTimesRef.current[fieldCompletionTimesRef.current.length - 1]
          : formMountedAtRef.current;

      if (now - lastTime < 200) {
        setSecurityBlockKey("register_suspicious_activity");
        return;
      }

      fieldCompletionTimesRef.current.push(now);
    },
    [securityBlockKey],
  );

  const emailIsValid = useMemo(
    () =>
      /^([a-zA-Z0-9_\-.+])+@([a-zA-Z0-9\-.])+\.([a-zA-Z]{2,})$/.test(email.trim()),
    [email],
  );

  const analysis = useMemo(() => analysePassword(password), [password]);
  const passwordMatches = password === confirmPassword && password.length > 0;
  const countrySelected = country.length > 0;
  const securityMessage = securityBlockKey ? t(securityBlockKey) : null;
  const now = Date.now();
  const isThrottled = throttleUntil > now;
  const throttleRemainingSeconds = isThrottled ? Math.ceil((throttleUntil - now) / 1000) : 0;
  const isDarkTheme = resolvedTheme === "dark";
  const socialButtonsEnabled = Boolean(keycloakConfig) && auth.isEnabled;

  const canSubmit =
    !isSubmitting &&
    !securityBlockKey &&
    isTimeGateOpen &&
    !isThrottled &&
    turnstileConfigured &&
    turnstileReady &&
    emailIsValid &&
    passwordMatches &&
    analysis.mandatoryPassed &&
    Boolean(fullName.trim()) &&
    countrySelected &&
    acceptPolicy &&
    website.trim().length === 0;

  const handleFullNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    detectRapidFill(fullName, nextValue);
    setFullName(nextValue);
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    detectRapidFill(email, nextValue);
    setEmail(nextValue);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    detectRapidFill(password, nextValue);
    setPassword(nextValue);
  };

  const handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    detectRapidFill(confirmPassword, nextValue);
    setConfirmPassword(nextValue);
  };

  const executeTurnstile = useCallback((): Promise<string> => {
    if (!turnstileConfigured) {
      return Promise.reject(new Error("turnstile-not-configured"));
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

  const handleSocialSignIn = useCallback(
    (provider: SocialProvider) => {
      if (!keycloakConfig || !auth.isEnabled) {
        return;
      }
      void auth.login({
        idpHint: provider.brokerPath,
        redirectUri: `${window.location.origin}/dashboard`,
        locale: i18n.language,
      });
    },
    [auth, i18n.language, keycloakConfig],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    setFormError(null);
    setFormSuccess(null);
    setTurnstileError(null);

    if (securityBlockKey) {
      setFormError(t(securityBlockKey));
      return;
    }

    if (website.trim().length > 0) {
      setSecurityBlockKey("register_suspicious_activity");
      setFormError(t("register_suspicious_activity"));
      return;
    }

    if (!isTimeGateOpen) {
      setFormError(t("register_time_gate_active"));
      return;
    }

    if (isThrottled) {
      setFormError(t("register_throttle_active", { seconds: throttleRemainingSeconds }));
      return;
    }

    if (
      !fullName.trim() ||
      !emailIsValid ||
      !passwordMatches ||
      !analysis.mandatoryPassed ||
      !countrySelected ||
      !acceptPolicy
    ) {
      setFormError(t("register_fix_errors"));
      return;
    }

    if (!turnstileConfigured) {
      setFormError(t("register_turnstile_disabled"));
      return;
    }

    if (!turnstileReady) {
      setFormError(t("register_turnstile_unavailable"));
      return;
    }

    let token: string;
    try {
      token = await executeTurnstile();
    } catch (error) {
      console.error("Turnstile execution failed", error);
      setTurnstileError(t("register_turnstile_failed"));
      setFormError(t("register_turnstile_failed"));
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
      return;
    }

    if (turnstileVerifyUrl) {
      try {
        const verificationResponse = await fetch(turnstileVerifyUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, action: TURNSTILE_ACTION }),
        });

        if (!verificationResponse.ok) {
          throw new Error(`Verification request failed (${verificationResponse.status})`);
        }

        const verificationPayload = (await verificationResponse.json()) as unknown;
        let verificationSuccess: boolean | null = null;

        if (isRecord(verificationPayload) && typeof verificationPayload.success === "boolean") {
          verificationSuccess = verificationPayload.success;
        }

        if (verificationSuccess === false) {
          setTurnstileError(t("register_turnstile_failed"));
          setFormError(t("register_turnstile_failed"));
          if (turnstileWidgetIdRef.current && window.turnstile) {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          }
          return;
        }
      } catch (error) {
        console.error("Turnstile verification failed", error);
        setTurnstileError(t("register_turnstile_failed"));
        setFormError(t("register_turnstile_failed"));
        if (turnstileWidgetIdRef.current && window.turnstile) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        return;
      }
    }

    const throttleExpiry = Date.now() + SUBMIT_THROTTLE_MS;
    setThrottleUntil(throttleExpiry);

    const backendUrlWithSlash = backendBaseUrl.endsWith("/")
      ? backendBaseUrl
      : `${backendBaseUrl}/`;
    const endpoint = new URL("/api/auth/register", backendUrlWithSlash);

    const { firstName, lastName } = splitFullName(fullName);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedWebsite = website.trim();

    const payload: Record<string, unknown> = {
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      captchaToken: token,
      locale: i18n.language,
      theme: resolvedTheme ?? "system",
      acceptPolicy,
    };

    if (country) {
      payload.country = [country];
    }

    if (normalizedWebsite.length > 0) {
      payload.website = [normalizedWebsite];
    }

    payload.formDurationMs = Math.max(
      0,
      Math.round(
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - formMountedAtRef.current,
      ),
    );

    try {
      setIsSubmitting(true);

      const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        let successMessage = t("register_success");
        try {
          const responseBody = (await response.clone().json()) as unknown;
          if (
            isRecord(responseBody) &&
            typeof responseBody.message === "string" &&
            responseBody.message.trim().length > 0
          ) {
            successMessage = responseBody.message;
          }
        } catch {
          // response body is not JSON; ignore and fall back to default message
        }

        setFormSuccess(successMessage);
        setFormError(null);
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setCountry("");
        setWebsite("");
        setAcceptPolicy(false);
        setAttemptedSubmit(false);
        fieldCompletionTimesRef.current = [];
        formMountedAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (redirectTimerRef.current !== null) {
          window.clearTimeout(redirectTimerRef.current);
        }
        redirectTimerRef.current = window.setTimeout(() => {
          void navigate("/auth/login", { replace: true });
        }, 1200);

        return;
      }

      let message = t("register_generic_error");
      try {
        const errorBody = (await response.clone().json()) as unknown;
        if (isRecord(errorBody)) {
          if (typeof errorBody.error === "string" && errorBody.error.trim().length > 0) {
            message = errorBody.error;
          } else if (
            typeof errorBody.message === "string" &&
            errorBody.message.trim().length > 0
          ) {
            message = errorBody.message;
          }
        }
      } catch {
        try {
          const text = await response.text();
          if (text.trim().length > 0) {
            message = text;
          }
        } catch {
          // no body available; keep default message
        }
      }

      if (response.status === 422) {
        message = t("register_turnstile_failed");
      } else if (response.status === 409) {
        message = t("register_email_exists");
      }

      setFormError(message);
    } catch (error) {
      console.error("Registration failed", error);
      setFormError(t("register_generic_error"));
    } finally {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
      setIsSubmitting(false);
    }
  };

  if (auth.isEnabled && auth.isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  const errorToShow = securityMessage ?? formError;

  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-xl border border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>{t("register_title")}</CardTitle>
          <CardDescription>{t("register_description")}</CardDescription>
        </CardHeader>
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setWebsite(value);
              if (value.trim().length > 0 && !securityBlockKey) {
                setSecurityBlockKey("register_suspicious_activity");
              }
            }}
            className="hidden"
            aria-hidden="true"
          />
          <div ref={turnstileContainerRef} className="hidden" aria-hidden="true" />
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("register_full_name")}</Label>
              <Input
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={handleFullNameChange}
                required
              />
              {attemptedSubmit && fullName.trim().length === 0 ? (
                <p className="text-xs text-destructive">{t("register_full_name_required")}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("register_email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={handleEmailChange}
                required
              />
              {!emailIsValid && email.length > 0 ? (
                <p className="text-xs text-destructive">{t("register_invalid_email")}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("register_password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? t("register_hide") : t("register_show")}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${analysis.colorClass}`}
                    style={{ width: `${(analysis.score / PASSWORD_CHECKS.length) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground">
                  {t("register_strength", { value: t(analysis.labelKey) })}
                </span>
              </div>
              <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <RequirementItem label={t("register_requirement_length")} met={analysis.checks.length} />
                <RequirementItem label={t("register_requirement_letter")} met={analysis.checks.letter} />
                <RequirementItem label={t("register_requirement_number")} met={analysis.checks.number} />
                <RequirementItem label={t("register_requirement_symbol")} met={analysis.checks.symbol} />
                <RequirementItem label={t("register_requirement_spaces")} met={analysis.checks.spaces} />
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("register_confirm_password")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="off"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2"
                  onClick={() => setShowConfirm((prev) => !prev)}
                >
                  {showConfirm ? t("register_hide") : t("register_show")}
                </Button>
              </div>
              {!passwordMatches && confirmPassword.length > 0 ? (
                <p className="text-xs text-destructive">{t("register_password_mismatch")}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">{t("register_country")}</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country">
                  <SelectValue placeholder={t("register_country_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {t(item.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {attemptedSubmit && !countrySelected ? (
                <p className="text-xs text-destructive">{t("register_country_required")}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <Checkbox
                id="policy"
                checked={acceptPolicy}
                onCheckedChange={(checked) => setAcceptPolicy(Boolean(checked))}
              />
              <div className="space-y-1 text-sm">
                <Label htmlFor="policy">{t("register_policy_title")}</Label>
                <p className="text-xs text-muted-foreground">{t("register_policy_text")}</p>
                {attemptedSubmit && !acceptPolicy ? (
                  <p className="text-xs text-destructive">{t("register_policy_required")}</p>
                ) : null}
              </div>
            </div>

            {turnstileConfigured ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t(turnstileReady ? "register_turnstile_ready" : "register_turnstile_loading")}
                {turnstileError ? <span className="ml-2 text-destructive">{turnstileError}</span> : null}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                {t("register_turnstile_disabled")}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border/70" />
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("register_social_divider")}
                </span>
                <span className="h-px flex-1 bg-border/70" />
              </div>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                {SOCIAL_PROVIDERS.map((provider) => {
                  const iconColor = isDarkTheme ? provider.darkColor : provider.lightColor;
                  const background = isDarkTheme ? provider.darkBackground : provider.lightBackground;
                  const borderColor = isDarkTheme ? "rgba(255,255,255,0.18)" : `${provider.lightColor}33`;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      aria-label={t(provider.translationKey)}
                      title={t(provider.translationKey)}
                      onClick={() => handleSocialSignIn(provider)}
                      disabled={!socialButtonsEnabled}
                      className="flex h-12 w-12 items-center justify-center rounded-full border text-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        backgroundColor: background,
                        borderColor,
                      }}
                    >
                      {provider.icon({ className: "h-5 w-5", color: iconColor })}
                    </button>
                  );
                })}
              </div>
              {!socialButtonsEnabled ? (
                <p className="text-xs text-muted-foreground">{t("register_social_unavailable")}</p>
              ) : null}
            </div>

            {errorToShow ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4" />
                <span>{errorToShow}</span>
              </div>
            ) : null}
            {formSuccess ? (
              <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
                <span>{formSuccess}</span>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {t("register_security_hint")}
            </span>
            <div className="flex flex-col items-end gap-1 sm:items-center sm:flex-row">
              {!isTimeGateOpen ? (
                <span className="text-xs text-muted-foreground">{t("register_time_gate_pending")}</span>
              ) : null}
              {isThrottled ? (
                <span className="text-xs text-muted-foreground">
                  {t("register_throttle_hint", { seconds: throttleRemainingSeconds })}
                </span>
              ) : null}
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? t("register_submitting") : t("register_cta")}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function RequirementItem({ label, met }: { label: string; met: boolean }) {
  return (
    <li className="flex items-center gap-1">
      {met ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default RegisterPage;
