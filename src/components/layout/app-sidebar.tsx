import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { AppLogo } from "@/components/layout/app-logo";
import { NAV_ITEMS, type NavItem } from "@/components/layout/navigation";
import { cn } from "@/lib/utils";

export function AppSidebar(): JSX.Element {
  const { t } = useTranslation();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
      <div className="mb-8 px-2">
        <AppLogo withText label={t("app_name")} />
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} label={t(item.labelKey)} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarLink({ to, label, icon: Icon }: NavItem & { label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )
      }
      end={to === "/"}
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
