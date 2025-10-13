import type { JSX } from "react";
import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

export type WorldMapStatus = "online" | "offline" | "maintenance";

export interface WorldMapReading {
  metric: string;
  value: number;
  unit: string;
}

export interface WorldMapSensor {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  status: WorldMapStatus;
  readings: WorldMapReading[];
  primaryMetric: WorldMapReading;
  city?: string;
  country?: string;
  metadata?: Record<string, string | number>;
}

export interface WorldMapProps {
  sensors: WorldMapSensor[];
  tileUrl?: string;
  attribution?: string;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  markerRadius?: (sensor: WorldMapSensor) => number;
  markerColor?: (sensor: WorldMapSensor) => string;
  renderTooltip?: (sensor: WorldMapSensor) => JSX.Element;
}

const DEFAULT_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const statusColorMap: Record<WorldMapStatus, string> = {
  online: "#22c55e",
  maintenance: "#facc15",
  offline: "#f97316",
};

function defaultMarkerColor(sensor: WorldMapSensor): string {
  return sensor.primaryMetric?.metric
    ? metricColor(sensor.primaryMetric.metric)
    : statusColorMap[sensor.status] ?? "#60a5fa";
}

function metricColor(metric: string): string {
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

function defaultMarkerRadius(sensor: WorldMapSensor): number {
  const sizeFactor = Math.min(sensor.readings.length, 6);
  return 5 + sizeFactor * 1.5;
}

function defaultTooltip(sensor: WorldMapSensor): JSX.Element {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">{sensor.name}</p>
      <p className="text-muted-foreground">
        {new Date(sensor.updatedAt).toLocaleString()}
      </p>
      <ul className="space-y-0.5">
        {sensor.readings.map((reading) => (
          <li key={`${sensor.id}-${reading.metric}`}>
            <span className="font-medium">{reading.metric}</span>: {reading.value} {reading.unit}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorldMap({
  sensors,
  tileUrl = DEFAULT_TILE,
  attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  center = [54.526, 15.2551],
  zoom = 4,
  minZoom = 2,
  maxZoom = 12,
  className,
  markerRadius = defaultMarkerRadius,
  markerColor = defaultMarkerColor,
  renderTooltip = defaultTooltip,
}: WorldMapProps): JSX.Element {
  const markers = useMemo(() => sensors, [sensors]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      preferCanvas
      className={className}
      style={{ width: "100%", height: "100%" }}
      attributionControl
    >
      <TileLayer attribution={attribution} url={tileUrl} />
      {markers.map((sensor) => (
        <CircleMarker
          key={sensor.id}
          center={[sensor.latitude, sensor.longitude]}
          radius={markerRadius(sensor)}
          pathOptions={{
            color: markerColor(sensor),
            fillOpacity: 0.85,
            weight: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -4]} opacity={1} permanent={false}>
            {renderTooltip(sensor)}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export default WorldMap;
