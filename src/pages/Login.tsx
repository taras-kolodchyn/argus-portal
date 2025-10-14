import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const validateEmail = (value: string) => /.+@.+\..+/i.test(value.trim());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();

    if (!validateEmail(trimmedEmail)) {
      setError(t("login_invalid_email"));
      return;
    }

    if (password.trim().length < 8) {
      setError(t("login_invalid_password"));
      return;
    }

    setIsSubmitting(true);

    try {
      await auth.login({ email: trimmedEmail, password });
      void navigate(from, { replace: true });
    } catch (loginError) {
      const message =
        loginError instanceof Error && loginError.message.toLowerCase().includes("invalid")
          ? t("login_invalid_credentials")
          : t("login_generic_error");
      setError(message);
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

            <Button className="w-full" type="submit" disabled={isSubmitting || auth.isLoading}>
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
