import type { JSX } from "react";
import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldMap, type WorldMapSensor, type ViewportState } from "@argus/world-map";

interface StatusSummary {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
}

function buildSummary(sensors: WorldMapSensor[]): StatusSummary {
  return sensors.reduce<StatusSummary>(
    (acc, sensor) => {
      acc.total += 1;
      if (sensor.status === "online") {
        acc.online += 1;
      } else if (sensor.status === "offline") {
        acc.offline += 1;
      } else {
        acc.maintenance += 1;
      }
      return acc;
    },
    { total: 0, online: 0, offline: 0, maintenance: 0 },
  );
}

export function WorldMapPage(): JSX.Element {
  const { t, i18n } = useTranslation();

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:4000";

  const [viewport, setViewport] = useState<ViewportState>({
    bounds: [-180, -85, 180, 85],
    center: { latitude: 54.526, longitude: 15.2551 },
    zoom: 3,
  });

  const handleViewportChange = useCallback((next: ViewportState) => {
    setViewport((prev) => {
      if (
        Math.abs(prev.bounds[0] - next.bounds[0]) < 0.0001 &&
        Math.abs(prev.bounds[1] - next.bounds[1]) < 0.0001 &&
        Math.abs(prev.bounds[2] - next.bounds[2]) < 0.0001 &&
        Math.abs(prev.bounds[3] - next.bounds[3]) < 0.0001 &&
        Math.abs(prev.zoom - next.zoom) < 0.0001
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const sensorsQuery = useQuery<WorldMapSensor[]>({
    queryKey: ["sensors", viewport.bounds, viewport.zoom, apiBase],
    queryFn: async (): Promise<WorldMapSensor[]> => {
      const params = new URLSearchParams({
        bbox: viewport.bounds.join(","),
        limit: "8000",
      });
      const response = await fetch(`${apiBase}/api/sensors?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Sensors request failed: ${response.statusText}`);
      }
      const body = (await response.json()) as { sensors: WorldMapSensor[] };
      return body.sensors;
    },
  });

  const summaryQuery = useQuery<StatusSummary>({
    queryKey: ["summary", apiBase],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/summary`);
      if (!response.ok) {
        throw new Error(`Summary request failed: ${response.statusText}`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const toNumber = (value: unknown) =>
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? Number.parseFloat(value)
            : 0;
      return {
        total: toNumber(payload.total),
        online: toNumber(payload.online),
        offline: toNumber(payload.offline),
        maintenance: toNumber(payload.maintenance),
      } satisfies StatusSummary;
    },
  });

  const sensors: WorldMapSensor[] = useMemo(
    () => sensorsQuery.data ?? [],
    [sensorsQuery.data],
  );

  const summary = useMemo(() => {
    if (summaryQuery.data) return summaryQuery.data;
    return buildSummary(sensors);
  }, [summaryQuery.data, sensors]);

  const sensorsLoading = sensorsQuery.isLoading;
  const sensorsError = sensorsQuery.isError;
  const formattedVisibleCount = sensors.length.toLocaleString(i18n.language);

  const statusColor = (status: WorldMapSensor["status"]): string => {
    switch (status) {
      case "online":
        return "text-emerald-500";
      case "maintenance":
        return "text-amber-500";
      case "offline":
      default:
        return "text-destructive";
    }
  };

  const sanitizeMetric = (metric: string) => metric.replace(/[^a-zA-Z0-9]/g, "_");

  const renderTooltip = (sensor: WorldMapSensor) => (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">
        {sensor.city}, {sensor.country}
      </p>
      <p className={`font-medium ${statusColor(sensor.status)}`}>
        {t(`world_map_status_${sensor.status}`)}
      </p>
      <ul className="space-y-1">
        {sensor.readings.map((reading) => (
          <li key={`${sensor.id}-${reading.metric}`}>
            {t(`metric_${sanitizeMetric(reading.metric)}`, {
              defaultValue: reading.metric,
            })}
            : {reading.value} {reading.unit}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        {t("world_map_updated")}: {new Date(sensor.updatedAt).toLocaleString(i18n.language)}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("world_map_total")}
            </CardTitle>
            <CardDescription>{t("world_map_active_network")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{summary.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-emerald-500">
              {t("world_map_online")}
            </CardTitle>
            <CardDescription>{t("world_map_online_hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-emerald-500">{summary.online.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-amber-500">
              {t("world_map_maintenance")}
            </CardTitle>
            <CardDescription>{t("world_map_maintenance_hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-amber-500">{summary.maintenance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/40 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-destructive">
              {t("world_map_offline")}
            </CardTitle>
            <CardDescription>{t("world_map_offline_hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-destructive">{summary.offline.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>{t("world_map_title")}</CardTitle>
          <CardDescription>{t("world_map_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[640px] w-full overflow-hidden rounded-xl border border-border/60">
            <WorldMap
              sensors={sensors}
              renderTooltip={renderTooltip}
              className="h-full w-full"
              minZoom={3}
              maxZoom={9}
              center={[54.526, 15.2551]}
              zoom={4}
              onViewportChange={handleViewportChange}
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {sensorsLoading
              ? t("world_map_loading")
              : t("world_map_visible", { formattedCount: formattedVisibleCount })}
            {sensorsError ? (
              <span className="ml-2 text-destructive">{t("world_map_error")}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WorldMapPage;
