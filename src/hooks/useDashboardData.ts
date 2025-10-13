import { subMinutes } from "date-fns";
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

const TREND_LENGTH = 24;
const TREND_STEP_MINUTES = 30;

interface MetricState {
  trend: MetricTrendPoint[];
}

const metricState: Record<MetricId, MetricState> = initializeMetricState();

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

const sensorState: Record<string, number> = initializeSensorState();

function initializeMetricState(): Record<MetricId, MetricState> {
  const now = new Date();

  return DASHBOARD_METRIC_IDS.reduce((acc, id) => {
    const meta = METRICS_META[id];
    let value = meta.baseline;
    const trend: MetricTrendPoint[] = Array.from({ length: TREND_LENGTH }, (_, index) => {
      const timestamp = subMinutes(
        now,
        (TREND_LENGTH - index) * TREND_STEP_MINUTES,
      );

      if (index !== 0) {
        value = nextValue(value, meta);
      }

      return {
        timestamp: timestamp.toISOString(),
        value: round(value, meta.decimals),
      };
    });

    acc[id] = { trend };
    return acc;
  }, {} as Record<MetricId, MetricState>);
}

function initializeSensorState(): Record<string, number> {
  return SENSOR_META.reduce((acc, sensor) => {
    const meta = METRICS_META[sensor.metricId];
    const baseline =
      meta.baseline + (sensor.baselineOffset ?? (Math.random() - 0.5) * meta.volatility);
    acc[sensor.id] = round(
      clamp(baseline, meta.bounds[0], meta.bounds[1]),
      meta.decimals,
    );
    return acc;
  }, {} as Record<string, number>);
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function randomDrift(range: number): number {
  return (Math.random() - 0.5) * range * 2;
}

function nextValue(previous: number, meta: MetricMeta): number {
  const next = previous + randomDrift(meta.volatility);
  const [min, max] = meta.bounds;
  return round(clamp(next, min, max), meta.decimals);
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
  const now = new Date();

  const metrics = DASHBOARD_METRIC_IDS.map((id) => {
    const meta = METRICS_META[id];
    const state = metricState[id];
    const previousTrend = state.trend;
    const previousValue = previousTrend[previousTrend.length - 1]?.value ?? meta.baseline;

    const nextMetricValue = nextValue(previousValue, meta);
    const nextPoint: MetricTrendPoint = {
      timestamp: now.toISOString(),
      value: nextMetricValue,
    };

    const trend = [...previousTrend.slice(1), nextPoint];
    metricState[id] = { trend };

    const comparisonPoint = trend[trend.length - 2] ?? previousTrend[previousTrend.length - 1];
    const delta = round(nextMetricValue - (comparisonPoint?.value ?? nextMetricValue), meta.decimals);
    const status = resolveStatus(id, nextMetricValue);

    return {
      id,
      labelKey: meta.labelKey,
      unitKey: meta.unitKey,
      value: nextMetricValue,
      delta,
      status,
      statusKey: METRIC_STATUS_LABELS[status],
      trend,
      decimals: meta.decimals,
    };
  });

  return {
    updatedAt: now.toISOString(),
    metrics,
  };
}

function buildSensorsSnapshot(): DashboardSensorsSnapshot {
  const now = new Date();

  const sensors = SENSOR_META.map((sensor) => {
    const meta = METRICS_META[sensor.metricId];
    const previous = sensorState[sensor.id] ?? meta.baseline;
    const next = nextValue(previous, meta);
    sensorState[sensor.id] = next;

    const status = resolveStatus(sensor.metricId, next);

    return {
      id: sensor.id,
      name: sensor.name,
      coordinates: sensor.coordinates,
      metricId: sensor.metricId,
      metricLabelKey: meta.labelKey,
      unitKey: meta.unitKey,
      value: next,
      status,
      statusKey: METRIC_STATUS_LABELS[status],
    };
  });

  return {
    updatedAt: now.toISOString(),
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
