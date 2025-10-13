import { useMemo } from "react";

import { useTheme } from "@/hooks/useTheme";

interface BasemapLayer {
  url: string;
  attribution: string;
  key: string;
}

const LIGHT_LAYER: BasemapLayer = {
  key: "light",
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const DARK_LAYER: BasemapLayer = {
  key: "dark",
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

export function useBasemapLayer(): BasemapLayer {
  const { resolved } = useTheme();

  return useMemo(() => (resolved === "dark" ? DARK_LAYER : LIGHT_LAYER), [resolved]);
}
