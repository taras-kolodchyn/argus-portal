import type { JSX } from "react";
import { LogIn, LogOut, ShieldAlert, UserCircle2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function ProfilePage(): JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile_preferences")}</CardTitle>
          <CardDescription>{t("profile")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ThemeToggle />
          <LanguageToggle />
        </CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardHeader className="flex flex-row items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle>{t("profile_keycloak_title")}</CardTitle>
            <CardDescription>{t("profile_keycloak_description")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!auth.isEnabled ? (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
              {t("auth_not_configured")}
            </div>
          ) : auth.isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground">
              <UserCircle2 className="h-5 w-5 animate-pulse" />
              <span>{t("auth_loading")}</span>
            </div>
          ) : auth.isAuthenticated && auth.profile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <UserCircle2 className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-base font-semibold">
                    {auth.profile.firstName ?? auth.profile.username ?? t("profile")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {auth.profile.email ?? auth.profile.username ?? ""}
                  </p>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("username")}</dt>
                  <dd className="font-medium">{auth.profile.username ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("email")}</dt>
                  <dd className="font-medium">{auth.profile.email ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("name")}</dt>
                  <dd className="font-medium">
                    {auth.profile.firstName ?? auth.profile.lastName
                      ? `${auth.profile.firstName ?? ""} ${auth.profile.lastName ?? ""}`.trim()
                      : "—"}
                  </dd>
                </div>
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
          ) : (
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
              <span>{t("auth_not_authenticated")}</span>
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
    </div>
  );
}
