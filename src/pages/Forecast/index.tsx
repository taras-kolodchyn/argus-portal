import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CloudSun,
  Gauge,
  Minus,
  type LucideIcon,
} from "lucide-react";

import { ForecastRangeChart } from "@/components/charts/forecast-range-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FORECAST_LEVEL_LABELS,
  type ForecastLevel,
  useForecastData,
} from "@/hooks/useForecastData";
import { cn } from "@/lib/utils";

const levelStyles: Record<ForecastLevel, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  moderate: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  high: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

const statIcons: Record<"dominant" | "change" | "peak", LucideIcon> = {
  dominant: BadgeCheck,
  change: Gauge,
  peak: CloudSun,
};

export function ForecastPage(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading } = useForecastData();

  const summary = data?.summary;

  const advice = useMemo(() => {
    if (!summary) {
      return [];
    }
    return t(`forecast_advice_${summary.level}`, {
      returnObjects: true,
    }) as string[];
  }, [summary, t]);

  const lastUpdated = data?.updatedAt
    ? formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })
    : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{t("forecast_aqi_title")}</CardTitle>
              <CardDescription>{t("forecast_aqi_description")}</CardDescription>
            </div>
            {summary && (
              <Badge className={cn("rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide", levelStyles[summary.level])}>
                {t(FORECAST_LEVEL_LABELS[summary.level])}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading || !data ? (
              <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                {t("forecast_loading")}
              </div>
            ) : (
              <ForecastRangeChart data={data.points} />
            )}
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            {lastUpdated ? t("last_updated", { value: lastUpdated }) : t("forecast_loading")}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Gauge className="h-4 w-4 text-primary" />
              {t("forecast_recommendation_title")}
            </CardTitle>
            <CardDescription>{t("forecast_recommendation_description")}</CardDescription>
          </CardHeader>
          {summary ? (
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("forecast_now")}
                  </p>
                  <p className="text-2xl font-semibold">
                    {summary.currentValue}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      {t("metric_units_aqi")}
                    </span>
                  </p>
                </div>
                <ForecastDelta value={summary.changeNext24h} t={t} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {t("forecast_recommendation_now", {
                    level: t(FORECAST_LEVEL_LABELS[summary.level]),
                  })}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {advice.map((item, index) => (
                    <li key={`advice-${index}`} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="text-sm text-muted-foreground">{t("forecast_loading")}</div>
            </CardContent>
          )}
        </Card>
      </section>

      {summary && (
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={statIcons.dominant}
            title={t("forecast_stat_dominant")}
            value={t(summary.dominantPollutantKey)}
            description={t("forecast_stat_dominant_hint")}
          />
          <StatCard
            icon={statIcons.change}
            title={t("forecast_stat_change")}
            value={
              summary.changeNext24h === 0
                ? t("forecast_delta_stable")
                : summary.changeNext24h > 0
                ? t("forecast_stat_change_up", {
                    value: Math.abs(summary.changeNext24h),
                  })
                : t("forecast_stat_change_down", {
                    value: Math.abs(summary.changeNext24h),
                  })
            }
            description={t("forecast_stat_change_hint")}
          />
          <StatCard
            icon={statIcons.peak}
            title={t("forecast_stat_peak")}
            value={summary.peakValue}
            description={t("forecast_stat_peak_hint", {
              time: format(new Date(summary.peakTimestamp), "EEE HH:mm"),
            })}
          />
        </section>
      )}
    </div>
  );
}

function ForecastDelta({ value, t }: { value: number; t: TFunction }): JSX.Element {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <Minus className="h-4 w-4" />
        {t("forecast_delta_stable")}
      </span>
    );
  }
  const isPositive = value > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(Math.abs(value));

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold",
        isPositive ? "text-red-500 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300",
      )}
    >
      <Icon className="h-4 w-4" />
      {isPositive
        ? t("forecast_delta_positive", { value: formatted })
        : t("forecast_delta_negative", { value: formatted })}
    </span>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: LucideIcon;
  title: string;
  value: number | string;
  description: string;
}): JSX.Element {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
