import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import {
  AlertOctagon,
  AlertTriangle,
  BellRing,
  Check,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useNotificationsFeed,
  useMarkAllNotificationsRead,
  type NotificationRecord,
} from "@/hooks/useNotificationsData";
import { cn } from "@/lib/utils";

const severityStyles = {
  critical: {
    border: "border-red-500/70",
    badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    icon: AlertOctagon,
  },
  warning: {
    border: "border-amber-500/60",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
    icon: AlertTriangle,
  },
  info: {
    border: "border-primary/60",
    badge: "bg-primary/10 text-primary",
    icon: BellRing,
  },
} as const;

export function NotificationsPage(): JSX.Element {
  const { t } = useTranslation();
  const { data: notifications, isLoading } = useNotificationsFeed();
  const markAll = useMarkAllNotificationsRead();

  const unreadCount = useMemo(
    () => notifications?.filter((item) => !item.isRead).length ?? 0,
    [notifications],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t("notifications_recent")}</CardTitle>
            <CardDescription>{t("notifications_overview_description")}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase tracking-wide">
              {t("notifications_unread_badge", { count: unreadCount })}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={unreadCount === 0 || markAll.isPending}
            >
              <Check className="mr-2 h-4 w-4" />
              {markAll.isPending ? t("notifications_marking") : t("notifications_mark_all")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          ) : notifications && notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              {t("notifications_empty")}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {t("notifications_hint")}
        </CardFooter>
      </Card>
    </div>
  );
}

function NotificationItem({ notification }: { notification: NotificationRecord }): JSX.Element {
  const { t } = useTranslation();
  const styles = severityStyles[notification.severity];
  const Icon = styles.icon;
  const relativeTime = formatDistanceToNow(new Date(notification.timestamp), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm transition-colors",
        styles.border,
        notification.isRead ? "bg-card/80" : "bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-muted",
              notification.isRead ? "opacity-60" : "opacity-100",
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-tight">{t(notification.titleKey)}</h3>
            <p className="text-xs text-muted-foreground">
              {t(notification.descriptionKey)}
            </p>
          </div>
        </div>
        <Badge className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", styles.badge)}>
          {t(`severity_${notification.severity}`)}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("notifications_time", { value: relativeTime })}</span>
        {!notification.isRead && (
          <span className="font-medium text-primary">{t("notifications_unread")}</span>
        )}
      </div>
    </div>
  );
}
