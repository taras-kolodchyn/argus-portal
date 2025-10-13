import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, CircleMarker, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";

import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import type { DashboardSensor } from "@/hooks/useDashboardData";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

L.Icon.Default.mergeOptions({
  iconUrl: marker,
  iconRetinaUrl: marker2x,
  shadowUrl: markerShadow,
});

const kyivCoordinates: LatLngExpression = [50.45, 30.52];

const statusToColor: Record<DashboardSensor["status"], string> = {
  good: "#00A86B",
  moderate: "#F59E0B",
  alert: "#EF4444",
};

interface CityMapProps {
  sensors: DashboardSensor[];
  className?: string;
}

export function CityMap({ sensors, className }: CityMapProps): JSX.Element {
  const position = useMemo(() => kyivCoordinates, []);
  const { t } = useTranslation();
  const { resolved } = useTheme();

  const tileLayer = useMemo(() => {
    if (resolved === "dark") {
      return {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      };
    }
    return {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
  }, [resolved]);

  return (
    <MapContainer
      center={position}
      zoom={10}
      scrollWheelZoom
      className={cn("h-[320px] w-full overflow-hidden rounded-xl border border-border", className)}
    >
      <TileLayer
        key={resolved}
        attribution={tileLayer.attribution}
        url={tileLayer.url}
      />
      {sensors.map((sensor) => {
        const color = statusToColor[sensor.status];
        return (
          <CircleMarker
            key={sensor.id}
            center={sensor.coordinates}
            radius={12}
            pathOptions={{
              color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.7,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div className="text-sm font-semibold text-foreground">{sensor.name}</div>
              <div className="text-xs text-muted-foreground">
                {sensor.value} {t(sensor.unitKey)}
              </div>
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{sensor.name}</div>
                <div>
                  {t(sensor.metricLabelKey)}: {sensor.value} {t(sensor.unitKey)}
                </div>
                <div>
                  {t("status")}: {t(sensor.statusKey)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
