import type { JSX } from "react";
import { LogIn, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function ProfilePage(): JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();

  const statusBadge = !auth.isEnabled
    ? { label: t("profile_status_offline"), tone: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" }
    : auth.isAuthenticated
      ? { label: t("profile_status_connected"), tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" }
      : { label: t("profile_status_disconnected"), tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/15">
              <UserCircle2 className="h-6 w-6" />
            </span>
            <div>
              <CardTitle>{t("profile_overview_title")}</CardTitle>
              <CardDescription>{t("profile_overview_description")}</CardDescription>
            </div>
          </div>
          <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.tone}`}>
            {statusBadge.label}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {!auth.isEnabled ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {t("auth_not_configured")}
            </div>
          ) : auth.isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <UserCircle2 className="h-5 w-5 animate-pulse" />
              <span>{t("auth_loading")}</span>
            </div>
          ) : auth.isAuthenticated && auth.profile ? (
            <AuthenticatedProfileCard />
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold">{t("auth_not_authenticated")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("profile_auth_hint")}
                </p>
              </div>
              <Button
                onClick={() => {
                  void auth.login();
                }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("login")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>{t("profile_preferences")}</CardTitle>
            <CardDescription>{t("profile_preferences_hint")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ThemeToggle />
          <LanguageToggle />
        </CardContent>
      </Card>
    </div>
  );
}

function AuthenticatedProfileCard(): JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();

  if (!auth.profile) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("profile_keycloak_placeholder")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {auth.profile.firstName?.charAt(0) ?? auth.profile.username?.charAt(0) ?? "A"}
        </span>
        <div>
          <p className="text-base font-semibold">
            {auth.profile.firstName ?? auth.profile.username ?? t("profile")}
          </p>
          <p className="text-sm text-muted-foreground">
            {auth.profile.email ?? auth.profile.username ?? ""}
          </p>
        </div>
      </div>
      <dl className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm">
        <ProfileField label={t("username")} value={auth.profile.username ?? "—"} />
        <ProfileField label={t("email")} value={auth.profile.email ?? "—"} />
        <ProfileField
          label={t("name")}
          value={
            auth.profile.firstName || auth.profile.lastName
              ? `${auth.profile.firstName ?? ""} ${auth.profile.lastName ?? ""}`.trim()
              : "—"
          }
        />
      </dl>
      <Button
        variant="outline"
        onClick={() => {
          void auth.logout();
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {t("logout")}
      </Button>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
