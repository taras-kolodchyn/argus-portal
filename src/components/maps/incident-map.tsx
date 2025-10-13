import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, CircleMarker, TileLayer, Tooltip } from "react-leaflet";

import type { ReportIncident } from "@/hooks/useReportsData";
import { useBasemapLayer } from "@/hooks/useBasemapLayer";
import { cn } from "@/lib/utils";

const ukraineCenter: [number, number] = [49.0, 31.5];

const statusColors: Record<ReportIncident["status"], string> = {
  open: "#EF4444",
  investigating: "#F59E0B",
  resolved: "#10B981",
};

interface IncidentMapProps {
  incidents: ReportIncident[];
  selectedId?: string | null;
  onSelect?: (incident: ReportIncident) => void;
  className?: string;
}

export function IncidentMap({
  incidents,
  selectedId,
  onSelect,
  className,
}: IncidentMapProps): JSX.Element {
  const center = useMemo(() => ukraineCenter, []);
  const { t } = useTranslation();
  const basemap = useBasemapLayer();

  return (
    <MapContainer
      center={center}
      zoom={6}
      scrollWheelZoom
      className={cn("h-[360px] w-full overflow-hidden rounded-xl border border-border", className)}
    >
      <TileLayer key={basemap.key} attribution={basemap.attribution} url={basemap.url} />
      {incidents.map((incident) => {
        const color = statusColors[incident.status];
        const isSelected = selectedId === incident.id;
        return (
          <CircleMarker
            key={incident.id}
            center={incident.coordinates}
            radius={isSelected ? 14 : 10}
            pathOptions={{
              color,
              weight: isSelected ? 3 : 2,
              fillColor: color,
              fillOpacity: isSelected ? 0.8 : 0.6,
            }}
            eventHandlers={{
              click: () => {
                onSelect?.(incident);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1} className="leaflet-tooltip">
              <div className="text-sm font-semibold text-foreground">
                {t(incident.titleKey)}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
