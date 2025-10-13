import { subHours } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import type { MetricId } from "@/hooks/useDashboardData";

export interface CompareMetricDefinition {
  id: MetricId;
  labelKey: string;
  unitKey: string;
  decimals: number;
  color: string;
  preferred: "lower" | "higher";
}

export interface CompareSummary {
  id: string;
  name: string;
  region: string;
  type: "station" | "district";
  metrics: Record<MetricId, number>;
}

export interface ComparePoint {
  timestamp: string;
  values: Record<MetricId, number>;
}

export interface CompareSnapshot {
  updatedAt: string;
  locations: CompareSummary[];
  datasets: Record<string, ComparePoint[]>;
}

const METRICS: CompareMetricDefinition[] = [
  {
    id: "aqi",
    labelKey: "metric_aqi",
    unitKey: "metric_units_aqi",
    decimals: 0,
    color: "var(--primary)",
    preferred: "lower",
  },
  {
    id: "noise",
    labelKey: "metric_noise",
    unitKey: "metric_units_noise",
    decimals: 0,
    color: "hsl(38 92% 56%)",
    preferred: "lower",
  },
  {
    id: "radiation",
    labelKey: "metric_radiation",
    unitKey: "metric_units_radiation",
    decimals: 2,
    color: "hsl(12 86% 58%)",
    preferred: "lower",
  },
];

interface LocationSeed {
  id: string;
  name: string;
  region: string;
  type: "station" | "district";
  baseline: Record<MetricId, number>;
}

const LOCATION_SEED: LocationSeed[] = [
  {
    id: "kyiv-center",
    name: "Kyiv Center",
    region: "Kyiv City",
    type: "station",
    baseline: {
      aqi: 48,
      noise: 56,
      radiation: 0.11,
    },
  },
  {
    id: "lviv-historic",
    name: "Lviv Historic",
    region: "Lviv Oblast",
    type: "district",
    baseline: {
      aqi: 38,
      noise: 49,
      radiation: 0.09,
    },
  },
  {
    id: "dnipro-industrial",
    name: "Dnipro Industrial",
    region: "Dnipropetrovsk Oblast",
    type: "station",
    baseline: {
      aqi: 72,
      noise: 62,
      radiation: 0.14,
    },
  },
  {
    id: "odesa-coastal",
    name: "Odesa Coastal",
    region: "Odesa Oblast",
    type: "district",
    baseline: {
      aqi: 44,
      noise: 52,
      radiation: 0.1,
    },
  },
];

const HOURS_RANGE = 24;

let datasetsState: Record<string, ComparePoint[]> | null = null;

function initializeDatasets(): Record<string, ComparePoint[]> {
  const now = new Date();

  return LOCATION_SEED.reduce((acc, location) => {
    const points: ComparePoint[] = Array.from({ length: HOURS_RANGE + 1 }, (_, index) => {
      const timestamp = subHours(now, HOURS_RANGE - index);
      const values = METRICS.reduce((metricsAcc, metric) => {
        const base = location.baseline[metric.id];
        const dailyWave = Math.sin((index / HOURS_RANGE) * Math.PI);
        const variation =
          metric.id === "radiation"
            ? dailyWave * 0.02 + randomBetween(-0.015, 0.015)
            : metric.id === "noise"
            ? dailyWave * 5 + randomBetween(-4, 4)
            : dailyWave * 4 + randomBetween(-3, 3);

        const value = base + variation;
        metricsAcc[metric.id] = round(metric.id, value);
        return metricsAcc;
      }, {} as Record<MetricId, number>);

      return {
        timestamp: timestamp.toISOString(),
        values,
      };
    });

    acc[location.id] = points;
    return acc;
  }, {} as Record<string, ComparePoint[]>);
}

function updateDatasets(state: Record<string, ComparePoint[]>): Record<string, ComparePoint[]> {
  return Object.fromEntries(
    Object.entries(state).map(([locationId, points]) => {
      const updatedPoints = points.map((point, index) => {
        const values = { ...point.values };
        METRICS.forEach((metric) => {
          const drift =
            metric.id === "radiation"
              ? randomBetween(-0.01, 0.01)
              : metric.id === "noise"
              ? randomBetween(-3, 3)
              : randomBetween(-2, 2);
          values[metric.id] = round(metric.id, values[metric.id] + drift);
        });

        if (index === points.length - 1) {
          return {
            timestamp: new Date().toISOString(),
            values,
          };
        }

        return {
          ...point,
          values,
        };
      });

      return [locationId, updatedPoints];
    }),
  );
}

function buildSnapshot(): CompareSnapshot {
  if (!datasetsState) {
    datasetsState = initializeDatasets();
  } else {
    datasetsState = updateDatasets(datasetsState);
  }

  const locations: CompareSummary[] = LOCATION_SEED.map((location) => {
    const dataset = datasetsState![location.id];
    const latest = dataset[dataset.length - 1];
    return {
      id: location.id,
      name: location.name,
      region: location.region,
      type: location.type,
      metrics: latest.values,
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    locations,
    datasets: datasetsState,
  };
}

function round(metric: MetricId, value: number): number {
  const definition = METRICS.find((item) => item.id === metric);
  const decimals = definition?.decimals ?? 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useCompareData() {
  return useQuery({
    queryKey: ["compare", "data"],
    queryFn: async () => {
      await wait(260);
      return buildSnapshot();
    },
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    staleTime: 10 * 1000,
  });
}

export function useCompareMetrics(): CompareMetricDefinition[] {
  return METRICS;
}
