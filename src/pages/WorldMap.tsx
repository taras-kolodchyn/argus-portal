import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { europeSensors } from "@/data/europeSensors";
import { WorldMap, type WorldMapSensor } from "@argus/world-map";

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
  const sensors: WorldMapSensor[] = europeSensors;

const summary = useMemo(() => buildSummary(sensors), [sensors]);

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
            <p className="text-3xl font-semibold">{summary.total}</p>
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
            <p className="text-3xl font-semibold text-emerald-500">{summary.online}</p>
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
            <p className="text-3xl font-semibold text-amber-500">{summary.maintenance}</p>
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
            <p className="text-3xl font-semibold text-destructive">{summary.offline}</p>
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
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WorldMapPage;
