import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Loader2, LogIn, LogOut, UserCircle2 } from "lucide-react";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NAV_ITEMS } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function AppHeader(): JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const auth = useAuth();

  const pageTitle = useMemo(() => {
    const active = NAV_ITEMS.find((item) => item.to === location.pathname);
    if (active) {
      return t(active.labelKey);
    }
    return t("app_name");
  }, [location.pathname, t]);

  return (
    <header className="flex flex-col gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("app_name")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
      </div>
      <nav className="flex flex-wrap items-center gap-2 lg:hidden">
        {NAV_ITEMS.map(({ to, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1 text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )
            }
            end={to === "/"}
          >
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-wrap items-start gap-4">
        <ThemeToggle />
        <LanguageToggle />
        {auth.isEnabled ? (
          auth.isAuthenticated && auth.profile ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <UserCircle2 className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm leading-tight">
                <p className="font-semibold">
                  {auth.profile.firstName ?? auth.profile.username ?? t("profile")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {auth.profile.email ?? auth.profile.username ?? ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void auth.logout();
                }}
              >
                <LogOut className="mr-1 h-3.5 w-3.5" />
                {t("logout")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 text-left">
              <span className="text-xs font-medium text-muted-foreground">
                {t("auth_session")}
              </span>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" className="h-10 w-[140px]">
                  <Link to="/register">{t("register_nav")}</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10"
                  onClick={() => {
                    void auth.login();
                  }}
                  disabled={auth.isLoading}
                >
                  {auth.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth_loading")}
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      {t("login")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            <UserCircle2 className="h-5 w-5" />
            <span>{t("auth_not_configured")}</span>
          </div>
        )}
      </div>
    </header>
  );
}
