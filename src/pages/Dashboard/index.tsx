import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Radiation,
  Volume2,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { MetricSparkline } from "@/components/charts/metric-sparkline";
import { EnvironmentTrendChart } from "@/components/charts/environment-trend-chart";
import { CityMap } from "@/components/maps/city-map";
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
  DASHBOARD_METRIC_IDS,
  type DashboardMetric,
  type DashboardSensor,
  type MetricId,
  type MetricStatus,
  useDashboardMetrics,
  useDashboardSensors,
} from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

const metricIcons: Record<MetricId, LucideIcon> = {
  aqi: Wind,
  noise: Volume2,
  radiation: Radiation,
};

const statusChipStyles: Record<MetricStatus, string> = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  moderate: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  alert: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

interface LegendItem {
  status: MetricStatus;
  count: number;
  labelKey: string;
  color: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getMetricColor(metric: DashboardMetric): string {
  switch (metric.id) {
    case "aqi":
      if (metric.value <= 50) return "#22c55e";
      if (metric.value <= 100) return "#facc15";
      if (metric.value <= 150) return "#f97316";
      return "#ef4444";
    case "noise":
      if (metric.value <= 45) return "#60a5fa";
      if (metric.value <= 60) return "#6366f1";
      if (metric.value <= 75) return "#7c3aed";
      return "#a21caf";
    case "radiation":
      if (metric.value <= 0.15) return "#22c55e";
      if (metric.value <= 0.3) return "#f97316";
      return "#ef4444";
    default:
      return "#6366f1";
  }
}

function MetricDelta({ value, decimals }: { value: number; decimals: number }): JSX.Element {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <Minus className="h-4 w-4" />
        0
      </span>
    );
  }

  const isPositive = value > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals > 0 ? 1 : 0,
    maximumFractionDigits: decimals,
  });
  const formatted = formatter.format(Math.abs(value));

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        isPositive ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-300",
      )}
    >
      <Icon className="h-4 w-4" />
      {value > 0 ? `+${formatted}` : `-${formatted}`}
    </span>
  );
}

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { data: metricsSnapshot, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: sensorsSnapshot, isLoading: sensorsLoading } = useDashboardSensors();

  const [insightsExpanded, setInsightsExpanded] = useState(false);

  const metrics = useMemo<DashboardMetric[]>(
    () => metricsSnapshot?.metrics ?? [],
    [metricsSnapshot?.metrics],
  );
  const sensors = useMemo<DashboardSensor[]>(
    () => sensorsSnapshot?.sensors ?? [],
    [sensorsSnapshot?.sensors],
  );

  const lastMetricsUpdated = metricsSnapshot?.updatedAt
    ? formatDistanceToNow(new Date(metricsSnapshot.updatedAt), { addSuffix: true })
    : null;

  const lastSensorsUpdated = sensorsSnapshot?.updatedAt
    ? formatDistanceToNow(new Date(sensorsSnapshot.updatedAt), { addSuffix: true })
    : null;

  const insights = useMemo(() => buildInsights(metrics, t), [metrics, t]);
  const DEFAULT_VISIBLE_INSIGHTS = 3;
  const visibleInsights = insightsExpanded || insights.length <= DEFAULT_VISIBLE_INSIGHTS
    ? insights
    : insights.slice(0, DEFAULT_VISIBLE_INSIGHTS);
  const canToggleInsights = insights.length > DEFAULT_VISIBLE_INSIGHTS;

  const goodCount = sensors.filter((sensor) => sensor.status === "good").length;
  const moderateCount = sensors.filter((sensor) => sensor.status === "moderate").length;
  const alertCount = sensors.filter((sensor) => sensor.status === "alert").length;

  const legendItems: LegendItem[] = [
    {
      status: "good" as MetricStatus,
      count: goodCount,
      labelKey: "metric_status_good",
      color: "#00A86B",
    },
    {
      status: "moderate" as MetricStatus,
      count: moderateCount,
      labelKey: "metric_status_moderate",
      color: "#F59E0B",
    },
    {
      status: "alert" as MetricStatus,
      count: alertCount,
      labelKey: "metric_status_alert",
      color: "#EF4444",
    },
  ].filter((item) => item.count > 0);

  const lineLabels = useMemo(
    () => ({
      aqi: t("metric_aqi"),
      noise: t("metric_noise"),
      radiation: t("metric_radiation"),
    }),
    [t],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricsLoading
          ? Array.from({ length: DASHBOARD_METRIC_IDS.length }).map((_, index) => (
              <Card key={`metric-skeleton-${index}`} className="border-dashed">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-24 rounded-md bg-muted/70" />
                    <div className="h-5 w-16 rounded-full bg-muted/70" />
                  </div>
                  <div className="h-8 w-28 rounded-md bg-muted/70" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 w-full rounded-lg bg-muted/70" />
                </CardContent>
              </Card>
            ))
          : metrics.map((metric) => {
              const Icon = metricIcons[metric.id];
              const accent = getMetricColor(metric);
              const iconStyle = {
                color: accent,
                backgroundColor: hexToRgba(accent, 0.15),
              };
              return (
                <Card key={metric.id} className="overflow-hidden">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-xl"
                            style={iconStyle}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          {t(metric.labelKey)}
                        </CardTitle>
                        <CardDescription>{t(metric.unitKey)}</CardDescription>
                      </div>
                      <Badge className={cn("rounded-full px-3 py-1 text-xs font-medium", statusChipStyles[metric.status])}>
                        {t(metric.statusKey)}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-semibold tracking-tight">{metric.value}</span>
                  <MetricDelta value={metric.delta} decimals={metric.decimals} />
                </div>
                  </CardHeader>
                  <CardContent className="mt-2 px-0 pb-4">
                    <MetricSparkline data={metric.trend} color={accent} />
                  </CardContent>
                </Card>
              );
            })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.75fr,1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{t("map_title")}</CardTitle>
              <CardDescription>
                {lastSensorsUpdated
                  ? t("last_updated", { value: lastSensorsUpdated })
                  : t("dashboard_pending_data")}
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full border-primary text-primary">
              {t("dashboard_sensor_total", { count: sensors.length })}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pb-6 pt-6">
            {sensorsLoading ? (
              <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                {t("dashboard_loading_map")}
              </div>
            ) : (
              <CityMap sensors={sensors} />
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("dashboard_map_legend_heading")}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {legendItems.map(({ status, count, labelKey, color }) => {
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-foreground">
                        {count}× {t(labelKey)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              {t("dashboard_live_title")}
            </CardTitle>
            <CardDescription>{t("dashboard_live_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("dashboard_pending_data")}</div>
            ) : (
              metrics.map((metric) => (
                <div key={`live-${metric.id}`} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card/60 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{t(metric.labelKey)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(metric.statusKey)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-semibold">{metric.value}</span>{" "}
                    <span className="text-muted-foreground">{t(metric.unitKey)}</span>
                    <div>
                      <MetricDelta value={metric.delta} decimals={metric.decimals} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.75fr,1fr]">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>{t("dashboard_environment_trend_title")}</CardTitle>
              <CardDescription>{t("dashboard_environment_trend_description")}</CardDescription>
            </div>
            {lastMetricsUpdated && (
              <Badge variant="outline" className="rounded-full text-xs font-medium">
                {t("last_updated", { value: lastMetricsUpdated })}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            {metrics.length > 0 ? (
              <EnvironmentTrendChart metrics={metrics} labels={lineLabels} />
            ) : (
              <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                {t("dashboard_pending_data")}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t("dashboard_insights_title")}
            </CardTitle>
            <CardDescription>{t("dashboard_insights_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleInsights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-xl border border-border bg-card/60 px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold leading-tight">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            ))}
            {canToggleInsights && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start px-2 text-xs font-semibold"
                onClick={() => setInsightsExpanded((prev) => !prev)}
              >
                {insightsExpanded ? t("dashboard_insights_collapse") : t("dashboard_insights_expand")}
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface Insight {
  id: string;
  metricId: MetricId;
  title: string;
  description: string;
}

function buildInsights(metrics: DashboardMetric[], t: TFunction): Insight[] {
  const hasAlert = metrics.filter((metric) => metric.status === "alert");
  const insights: Insight[] = metrics.map((metric) => ({
    id: `metric-${metric.id}`,
    metricId: metric.id,
    title: t("dashboard_insight_metric_status", {
      metric: t(metric.labelKey),
      status: t(metric.statusKey),
    }),
    description: metric.delta > 0
      ? t("dashboard_insight_delta_positive", {
          value: metric.delta,
          unit: t(metric.unitKey),
        })
      : metric.delta < 0
      ? t("dashboard_insight_delta_negative", {
          value: Math.abs(metric.delta),
          unit: t(metric.unitKey),
        })
      : t("dashboard_insight_delta_neutral"),
  }));

  if (hasAlert.length === 0 && metrics.length > 0) {
    insights.unshift({
      id: `all-clear-${metrics[0].id}`,
      metricId: metrics[0].id,
      title: t("dashboard_insight_all_clear_title"),
      description: t("dashboard_insight_all_clear_description"),
    });
  }

  return insights.slice(0, 3);
}
