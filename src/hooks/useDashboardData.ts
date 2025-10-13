import { useQuery } from "@tanstack/react-query";

export const DASHBOARD_METRIC_IDS = ["aqi", "noise", "radiation", "water"] as const;

export type MetricId = (typeof DASHBOARD_METRIC_IDS)[number];
export type MetricStatus = "good" | "moderate" | "alert";

export interface MetricTrendPoint {
  timestamp: string;
  value: number;
}

export interface DashboardMetric {
  id: MetricId;
  labelKey: string;
  unitKey: string;
  value: number;
  delta: number;
  status: MetricStatus;
  statusKey: string;
  trend: MetricTrendPoint[];
  decimals: number;
}

export interface DashboardMetricsSnapshot {
  updatedAt: string;
  metrics: DashboardMetric[];
}

export interface DashboardSensor {
  id: string;
  name: string;
  coordinates: [number, number];
  metricId: MetricId;
  metricLabelKey: string;
  unitKey: string;
  value: number;
  status: MetricStatus;
  statusKey: string;
}

export interface DashboardSensorsSnapshot {
  updatedAt: string;
  sensors: DashboardSensor[];
}

export const METRIC_STATUS_LABELS: Record<MetricStatus, string> = {
  good: "metric_status_good",
  moderate: "metric_status_moderate",
  alert: "metric_status_alert",
};

interface MetricMeta {
  labelKey: string;
  unitKey: string;
  decimals: number;
  baseline: number;
  bounds: [number, number];
  volatility: number;
}

const METRICS_META: Record<MetricId, MetricMeta> = {
  aqi: {
    labelKey: "metric_aqi",
    unitKey: "metric_units_aqi",
    decimals: 0,
    baseline: 42,
    bounds: [8, 160],
    volatility: 8,
  },
  noise: {
    labelKey: "metric_noise",
    unitKey: "metric_units_noise",
    decimals: 0,
    baseline: 55,
    bounds: [30, 90],
    volatility: 4,
  },
  radiation: {
    labelKey: "metric_radiation",
    unitKey: "metric_units_radiation",
    decimals: 2,
    baseline: 0.12,
    bounds: [0.05, 0.6],
    volatility: 0.02,
  },
  water: {
    labelKey: "metric_water",
    unitKey: "metric_units_water",
    decimals: 2,
    baseline: 7.2,
    bounds: [5.5, 8.8],
    volatility: 0.1,
  },
};

const METRIC_SEEDS: Record<MetricId, number> = {
  aqi: 0.3,
  noise: 0.9,
  radiation: 1.7,
  water: 2.3,
};

interface SensorMeta {
  id: string;
  name: string;
  coordinates: [number, number];
  metricId: MetricId;
  baselineOffset?: number;
}

const SENSOR_META: SensorMeta[] = [
  {
    id: "kyiv-center",
    name: "Kyiv City Hall",
    coordinates: [50.4501, 30.5234],
    metricId: "aqi",
  },
  {
    id: "podil",
    name: "Podil Riverside",
    coordinates: [50.471, 30.5061],
    metricId: "water",
    baselineOffset: -0.2,
  },
  {
    id: "obolon",
    name: "Obolon Eco Park",
    coordinates: [50.523, 30.4986],
    metricId: "noise",
    baselineOffset: 6,
  },
  {
    id: "troieshchyna",
    name: "Troieshchyna Station",
    coordinates: [50.5132, 30.6047],
    metricId: "radiation",
    baselineOffset: 0.03,
  },
  {
    id: "zoloti-vorota",
    name: "Zoloti Vorota",
    coordinates: [50.4478, 30.5133],
    metricId: "aqi",
  },
  {
    id: "sviatoshyn",
    name: "Sviatoshyn Park",
    coordinates: [50.4576, 30.3553],
    metricId: "noise",
    baselineOffset: -5,
  },
  {
    id: "pechersk",
    name: "Pechersk Hills",
    coordinates: [50.4268, 30.5615],
    metricId: "radiation",
    baselineOffset: -0.02,
  },
];

const TREND_LENGTH = 24;
const TREND_STEP_MINUTES = 30;
const MINUTE_IN_MS = 60 * 1000;
const BASE_PERIOD_MS = 6 * 60 * MINUTE_IN_MS;

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeMetricValue(
  meta: MetricMeta,
  timestamp: number,
  seed: number,
  baselineOffset = 0,
): number {
  const baseWave = Math.sin(timestamp / BASE_PERIOD_MS + seed) * meta.volatility * 1.4;
  const secondary = Math.sin(timestamp / (BASE_PERIOD_MS / 2) + seed * 1.7) * meta.volatility * 0.8;
  const micro = Math.cos(timestamp / (BASE_PERIOD_MS * 1.5) + seed * 2.3) * meta.volatility * 0.4;
  const baseline = meta.baseline + baselineOffset;
  const value = baseline + baseWave + secondary + micro;
  return round(clamp(value, meta.bounds[0], meta.bounds[1]), meta.decimals);
}

function generateMetricTrend(meta: MetricMeta, seed: number, reference: number): MetricTrendPoint[] {
  return Array.from({ length: TREND_LENGTH }, (_, index) => {
    const timestamp = reference - (TREND_LENGTH - index) * TREND_STEP_MINUTES * MINUTE_IN_MS;
    return {
      timestamp: new Date(timestamp).toISOString(),
      value: computeMetricValue(meta, timestamp, seed),
    };
  });
}

function resolveStatus(id: MetricId, value: number): MetricStatus {
  switch (id) {
    case "aqi":
      if (value <= 50) return "good";
      if (value <= 100) return "moderate";
      return "alert";
    case "noise":
      if (value <= 55) return "good";
      if (value <= 70) return "moderate";
      return "alert";
    case "radiation":
      if (value <= 0.15) return "good";
      if (value <= 0.3) return "moderate";
      return "alert";
    case "water": {
      const delta = Math.abs(7 - value);
      if (delta <= 0.4) return "good";
      if (delta <= 1) return "moderate";
      return "alert";
    }
    default:
      return "moderate";
  }
}

function buildMetricsSnapshot(): DashboardMetricsSnapshot {
  const now = Date.now();

  const metrics = DASHBOARD_METRIC_IDS.map((id) => {
    const meta = METRICS_META[id];
    const trend = generateMetricTrend(meta, METRIC_SEEDS[id], now);
    const latest = trend[trend.length - 1]?.value ?? meta.baseline;
    const previous = trend[trend.length - 2]?.value ?? latest;
    const delta = round(latest - previous, meta.decimals);
    const status = resolveStatus(id, latest);

    return {
      id,
      labelKey: meta.labelKey,
      unitKey: meta.unitKey,
      value: latest,
      delta,
      status,
      statusKey: METRIC_STATUS_LABELS[status],
      trend,
      decimals: meta.decimals,
    };
  });

  return {
    updatedAt: new Date(now).toISOString(),
    metrics,
  };
}

function buildSensorsSnapshot(): DashboardSensorsSnapshot {
  const now = Date.now();

  const sensors = SENSOR_META.map((sensor, index) => {
    const meta = METRICS_META[sensor.metricId];
    const seed = METRIC_SEEDS[sensor.metricId] + (index + 1) * 0.37;
    const value = computeMetricValue(meta, now, seed, sensor.baselineOffset ?? 0);
    const status = resolveStatus(sensor.metricId, value);

    return {
      id: sensor.id,
      name: sensor.name,
      coordinates: sensor.coordinates,
      metricId: sensor.metricId,
      metricLabelKey: meta.labelKey,
      unitKey: meta.unitKey,
      value,
      status,
      statusKey: METRIC_STATUS_LABELS[status],
    };
  });

  return {
    updatedAt: new Date(now).toISOString(),
    sensors,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: async () => {
      await wait(180);
      return buildMetricsSnapshot();
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

export function useDashboardSensors() {
  return useQuery({
    queryKey: ["dashboard", "sensors"],
    queryFn: async () => {
      await wait(220);
      return buildSensorsSnapshot();
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}
