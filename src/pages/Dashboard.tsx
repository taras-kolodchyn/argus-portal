import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { AqiTrendChart } from "@/components/charts/aqi-trend-chart";
import { CityMap } from "@/components/maps/city-map";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAqiSeries, useDashboardMetrics } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

export function DashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const { data: metrics, isLoading: loadingMetrics } = useDashboardMetrics();
  const { data: aqiSeries, isLoading: loadingSeries } = useAqiSeries();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loadingMetrics &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={`metric-placeholder-${index}`}
              className="animate-pulse border-dashed"
            >
              <CardHeader>
                <CardDescription>{t("metric_aqi")}</CardDescription>
                <CardTitle className="text-3xl">—</CardTitle>
              </CardHeader>
            </Card>
          ))}
        {metrics?.map((metric) => (
          <Card key={metric.id}>
            <CardHeader>
              <CardDescription>{t(metric.labelKey)}</CardDescription>
              <CardTitle className="text-3xl font-semibold">
                {metric.value}
                <span className="ml-2 text-base font-medium text-muted-foreground">
                  {t(metric.unitKey)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span
                className={cn(
                  "text-sm font-medium",
                  metric.delta >= 0 ? "text-emerald-500" : "text-red-500",
                )}
              >
                {metric.delta >= 0 ? "+" : ""}
                {metric.delta}
              </span>
              <span className="ml-1 text-sm text-muted-foreground">24h</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("map_title")}</CardTitle>
            <CardDescription>{t("last_updated", { value: "1m" })}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <CityMap />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("recent_aqi")}</CardTitle>
            <CardDescription>{t("metric_units_aqi")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingSeries || !aqiSeries ? (
              <div className="flex h-[240px] w-full items-center justify-center text-sm text-muted-foreground">
                {t("refresh")}
              </div>
            ) : (
              <AqiTrendChart data={aqiSeries} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
