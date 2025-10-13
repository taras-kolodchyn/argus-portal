import type { JSX } from "react";
import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { europeSensors, type SensorLocation } from "@/data/europeSensors";

const MAP_CENTER: [number, number] = [54.526, 15.2551];

interface StatusSummary {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
}

function buildSummary(sensors: SensorLocation[]): StatusSummary {
  return sensors.reduce<StatusSummary>(
    (acc, sensor) => {
      acc.total += 1;
      acc[sensor.status] += 1;
      return acc;
    },
    { total: 0, online: 0, offline: 0, maintenance: 0 },
  );
}

function markerColor(metric: SensorLocation["primaryMetric"]["metric"]): string {
  switch (metric) {
    case "AQI":
      return "#ef4444";
    case "PM2.5":
      return "#f97316";
    case "Radiation":
      return "#14b8a6";
    case "Water":
      return "#3b82f6";
    case "Noise":
    default:
      return "#a855f7";
  }
}

export function WorldMapPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const sensors = europeSensors;

  const summary = useMemo(() => buildSummary(sensors), [sensors]);

  const statusColor = (status: SensorLocation["status"]): string => {
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
            <MapContainer
              center={MAP_CENTER}
              zoom={4}
              minZoom={3}
              maxZoom={9}
              className="h-full w-full"
              attributionControl
              preferCanvas
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {sensors.map((sensor) => (
                <CircleMarker
                  key={sensor.id}
                  center={[sensor.latitude, sensor.longitude]}
                  radius={5 + sensor.readings.length}
                  pathOptions={{
                    color: markerColor(sensor.primaryMetric.metric),
                    fillOpacity: 0.85,
                    weight: 1,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1} permanent={false}>
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
                            {t(`metric_${reading.metric}`)}: {reading.value} {reading.unit}
                          </li>
                        ))}
                      </ul>
                      <p className="text-muted-foreground">
                        {t("world_map_updated")}: {new Date(sensor.updatedAt).toLocaleString(i18n.language)}
                      </p>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WorldMapPage;
