import type { JSX } from "react";
import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";

import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconUrl: marker,
  iconRetinaUrl: marker2x,
  shadowUrl: markerShadow,
});

const kyivCoordinates: LatLngExpression = [50.45, 30.52];

export function CityMap(): JSX.Element {
  const position = useMemo(() => kyivCoordinates, []);

  return (
    <MapContainer
      center={position}
      zoom={10}
      scrollWheelZoom
      className="h-[320px] w-full rounded-xl border border-border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position}>
        <Popup>Kyiv, Ukraine</Popup>
      </Marker>
    </MapContainer>
  );
}
