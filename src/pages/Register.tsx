import type { ChangeEvent, FormEvent, JSX } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, ShieldAlert, X } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordAnalysis {
  score: number;
  labelKey: string;
  colorClass: string;
  checks: Record<string, boolean>;
}

function analysePassword(password: string, email: string): PasswordAnalysis {
  const trimmed = password.trim();
  const checks: Record<string, boolean> = {
    length: trimmed.length >= 12,
    upper: /[A-Z]/.test(trimmed),
    lower: /[a-z]/.test(trimmed),
    number: /\d/.test(trimmed),
    symbol: /[^A-Za-z0-9\s]/.test(trimmed),
    spaces: !/\s/.test(trimmed),
    email: email.length === 0 || !trimmed.toLowerCase().includes(email.toLowerCase()),
    repeats: !/(.)\1{2,}/.test(trimmed),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = Math.min(passedChecks, 8);

  let labelKey = "register_strength_weak";
  let colorClass = "bg-destructive";
  if (score >= 7) {
    labelKey = "register_strength_excellent";
    colorClass = "bg-emerald-500";
  } else if (score >= 6) {
    labelKey = "register_strength_strong";
    colorClass = "bg-green-500";
  } else if (score >= 5) {
    labelKey = "register_strength_good";
    colorClass = "bg-lime-500";
  } else if (score >= 4) {
    labelKey = "register_strength_fair";
    colorClass = "bg-amber-500";
  }

  return { score, labelKey, colorClass, checks };
}

export function RegisterPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const rawRecaptchaKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim() ?? "";
  const recaptchaConfigured = rawRecaptchaKey.length > 0;
  const { executeRecaptcha } = useGoogleReCaptcha();

  const analysis = useMemo(() => analysePassword(password, email), [password, email]);

  const emailIsValid = useMemo(
    () =>
      /^([a-zA-Z0-9_\-.+])+@([a-zA-Z0-9\-.])+\.([a-zA-Z]{2,})$/.test(email.trim()),
    [email],
  );

  const passwordMatches = password === confirmPassword && password.length > 0;

  const canSubmit =
    !isSubmitting &&
    recaptchaConfigured &&
    Boolean(executeRecaptcha) &&
    emailIsValid &&
    passwordMatches &&
    analysis.score >= 6 &&
    Boolean(fullName.trim()) &&
    acceptPolicy;

  const handleInputChange = (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => setter(event.target.value);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!acceptPolicy || !emailIsValid || !passwordMatches || analysis.score < 6 || !fullName.trim()) {
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
      token = await executeRecaptcha("register_submit");
    } catch (error) {
      console.error("reCAPTCHA execution failed", error);
      setCaptchaError(t("register_recaptcha_failed"));
      return;
    }

    if (!token) {
      setCaptchaError(t("register_recaptcha_failed"));
      return;
    }

    setCaptchaError(null);

    try {
      setIsSubmitting(true);
      // TODO: Replace with actual registration request (e.g., call to secure API or Keycloak endpoint)
      await Promise.resolve();
      setFormSuccess(t("register_success"));
      void navigate("/profile", { replace: true });
    } catch (error) {
      console.error("Registration failed", error);
      setFormError(t("register_generic_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("register_full_name")}</Label>
              <Input
                id="fullName"
                autoComplete="name"
                value={fullName}
                onChange={handleInputChange(setFullName)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("register_email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={handleInputChange(setEmail)}
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
                  autoComplete="new-password"
                  value={password}
                  onChange={handleInputChange(setPassword)}
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
                    style={{ width: `${(analysis.score / 8) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground">{t("register_strength", { value: t(analysis.labelKey) })}</span>
              </div>
              <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <RequirementItem
                  label={t("register_requirement_length")}
                  met={analysis.checks.length}
                />
                <RequirementItem
                  label={t("register_requirement_upper")}
                  met={analysis.checks.upper}
                />
                <RequirementItem
                  label={t("register_requirement_lower")}
                  met={analysis.checks.lower}
                />
                <RequirementItem label={t("register_requirement_number")} met={analysis.checks.number} />
                <RequirementItem label={t("register_requirement_symbol")} met={analysis.checks.symbol} />
                <RequirementItem label={t("register_requirement_spaces")} met={analysis.checks.spaces} />
                <RequirementItem label={t("register_requirement_email")} met={analysis.checks.email} />
                <RequirementItem label={t("register_requirement_repeats")} met={analysis.checks.repeats} />
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("register_confirm_password")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={handleInputChange(setConfirmPassword)}
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

            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <Checkbox
                id="policy"
                checked={acceptPolicy}
                onCheckedChange={(checked) => setAcceptPolicy(Boolean(checked))}
              />
              <div className="space-y-1 text-sm">
                <Label htmlFor="policy">{t("register_policy_title")}</Label>
                <p className="text-xs text-muted-foreground">{t("register_policy_text")}</p>
              </div>
            </div>

            {recaptchaConfigured ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {t(executeRecaptcha ? "register_recaptcha_ready" : "register_recaptcha_loading")}
                {captchaError ? (
                  <span className="ml-2 text-destructive">{captchaError}</span>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                {t("register_recaptcha_disabled")}
              </div>
            )}

            {formError ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4" />
                <span>{formError}</span>
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
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? t("register_submitting") : t("register_cta")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function RequirementItem({ label, met }: { label: string; met: boolean }) {
  return (
    <li className="flex items-center gap-1">
      {met ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default RegisterPage;
