import type { JSX } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertOctagon, Bell, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useDashboardData";

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    color: "text-destructive",
    border: "border-destructive/60",
    key: "severity_critical",
  },
  warning: {
    icon: Bell,
    color: "text-amber-500",
    border: "border-amber-400/60",
    key: "severity_warning",
  },
  info: {
    icon: Info,
    color: "text-primary",
    border: "border-primary/60",
    key: "severity_info",
  },
} as const;

export function NotificationsPage(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading } = useNotifications();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("notifications_recent")}</CardTitle>
          <CardDescription>{t("view_all")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("refresh")}
            </p>
          )}
          {!isLoading && data && data.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("notifications_empty")}
            </p>
          )}
          {data?.map((item) => {
            const config = severityConfig[item.severity];
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-4 rounded-xl border bg-card/80 p-4",
                  config.border,
                )}
              >
                <Icon className={cn("mt-0.5 h-5 w-5", config.color)} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <span className={cn("text-xs font-medium", config.color)}>
                      {t(config.key)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
