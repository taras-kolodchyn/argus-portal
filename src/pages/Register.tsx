import type { ChangeEvent, FormEvent, JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, ShieldAlert, X } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getKeycloakEnvConfig } from "@/lib/env";

type PasswordCheck = "length" | "letter" | "number" | "symbol" | "spaces";

const REQUIRED_CHECKS: PasswordCheck[] = ["length", "letter", "number", "symbol"];
const PASSWORD_CHECKS: PasswordCheck[] = [...REQUIRED_CHECKS, "spaces"];
const TIME_GATE_MS = 1500;
const SUBMIT_THROTTLE_MS = 5000;
const RECAPTCHA_ACTION = "register";
const RECAPTCHA_THRESHOLD = 0.5;

interface PasswordAnalysis {
  score: number;
  labelKey: string;
  colorClass: string;
  checks: Record<PasswordCheck, boolean>;
  mandatoryPassed: boolean;
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaScore, setCaptchaScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securityBlockKey, setSecurityBlockKey] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isTimeGateOpen, setIsTimeGateOpen] = useState(false);
  const [throttleUntil, setThrottleUntil] = useState<number>(0);

  const rawRecaptchaKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim() ?? "";
  const recaptchaVerificationUrl =
    (import.meta.env.VITE_RECAPTCHA_VERIFY_URL as string | undefined)?.trim() ?? "";
  const keycloakConfig = getKeycloakEnvConfig();
  const recaptchaConfigured = rawRecaptchaKey.length > 0;
  const { executeRecaptcha } = useGoogleReCaptcha();

  const formMountedAtRef = useRef<number>(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );
  const fieldCompletionTimesRef = useRef<number[]>([]);
  const redirectTimerRef = useRef<number | null>(null);

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

  const canSubmit =
    !isSubmitting &&
    !securityBlockKey &&
    isTimeGateOpen &&
    !isThrottled &&
    recaptchaConfigured &&
    Boolean(executeRecaptcha) &&
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    setFormError(null);
    setFormSuccess(null);
    setCaptchaError(null);
    setCaptchaScore(null);

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

    if (!recaptchaConfigured) {
      setFormError(t("register_recaptcha_disabled"));
      return;
    }

    if (!executeRecaptcha) {
      setFormError(t("register_recaptcha_unavailable"));
      return;
    }

    let token: string | null = null;
    try {
      token = await executeRecaptcha(RECAPTCHA_ACTION);
    } catch (error) {
      console.error("reCAPTCHA execution failed", error);
      setCaptchaError(t("register_recaptcha_failed"));
      return;
    }

    if (!token) {
      setCaptchaError(t("register_recaptcha_failed"));
      return;
    }

    if (recaptchaVerificationUrl) {
      try {
        const verificationResponse = await fetch(recaptchaVerificationUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, action: RECAPTCHA_ACTION }),
        });

        if (!verificationResponse.ok) {
          throw new Error(`Verification request failed (${verificationResponse.status})`);
        }

        const verificationPayload = (await verificationResponse.json()) as unknown;
        let verificationScore: number | null = null;
        let verificationSuccess: boolean | null = null;

        if (isRecord(verificationPayload)) {
          const score = verificationPayload.score;
          const success = verificationPayload.success;

          if (typeof score === "number") {
            verificationScore = score;
          }
          if (typeof success === "boolean") {
            verificationSuccess = success;
          }
        }

        if (verificationScore !== null) {
          setCaptchaScore(verificationScore);
          if (verificationScore < RECAPTCHA_THRESHOLD) {
            setCaptchaError(t("register_recaptcha_low_score"));
            return;
          }
        } else if (verificationSuccess === false) {
          setCaptchaError(t("register_recaptcha_failed"));
          return;
        }
      } catch (error) {
        console.error("reCAPTCHA verification failed", error);
        setCaptchaError(t("register_recaptcha_failed"));
        return;
      }
    }

    if (!keycloakConfig) {
      setFormError(t("register_keycloak_unavailable"));
      return;
    }

    const throttleExpiry = Date.now() + SUBMIT_THROTTLE_MS;
    setThrottleUntil(throttleExpiry);

    const endpoint = new URL(
      `/auth/realms/${encodeURIComponent(
        keycloakConfig.realm,
      )}/protocol/openid-connect/registrations`,
      keycloakConfig.url.endsWith("/") ? keycloakConfig.url : `${keycloakConfig.url}/`,
    );
    endpoint.searchParams.set("client_id", keycloakConfig.clientId);
    endpoint.searchParams.set("scope", "openid");

    const { firstName, lastName } = splitFullName(fullName);
    const normalizedEmail = email.trim().toLowerCase();

    const payload = {
      username: normalizedEmail,
      email: normalizedEmail,
      firstName,
      lastName,
      enabled: true,
      emailVerified: false,
      attributes: {
        country: [country],
      },
      requiredActions: ["VERIFY_EMAIL"],
      credentials: [
        {
          type: "password",
          value: password,
          temporary: false,
        },
      ],
    };

    try {
      setIsSubmitting(true);

      const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Recaptcha-Token": token,
          "X-Recaptcha-Action": RECAPTCHA_ACTION,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setFormSuccess(t("register_success"));
        setFormError(null);
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setCountry("");
        setWebsite("");
        setAcceptPolicy(false);
        setAttemptedSubmit(false);
        setCaptchaScore(null);
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
        let description = "";
        if (isRecord(errorBody)) {
          const err = typeof errorBody.error === "string" ? errorBody.error : "";
          const errDescription =
            typeof errorBody.error_description === "string" ? errorBody.error_description : "";
          description = `${err} ${errDescription}`.trim().toLowerCase();
        }
        if (response.status === 409 || description.includes("exist")) {
          message = t("register_email_exists");
        } else if (description.includes("password")) {
          message = t("register_password_rejected");
        }
      } catch {
        const text = await response.text();
        if (response.status === 409 || text.toLowerCase().includes("exist")) {
          message = t("register_email_exists");
        }
      }

      setFormError(message);
    } catch (error) {
      console.error("Registration failed", error);
      setFormError(t("register_generic_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auth.isEnabled && auth.isLoading) {
    return (
      <div className="flex justify-center py-10 text-sm text-muted-foreground">
        {t("auth_loading")}
      </div>
    );
  }

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

            {recaptchaConfigured ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t(executeRecaptcha ? "register_recaptcha_ready" : "register_recaptcha_loading")}
                {captchaScore !== null ? (
                  <span className="ml-2">{t("register_recaptcha_score", { value: captchaScore.toFixed(2) })}</span>
                ) : null}
                {captchaError ? <span className="ml-2 text-destructive">{captchaError}</span> : null}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                {t("register_recaptcha_disabled")}
              </div>
            )}

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
