import { useQuery } from "@tanstack/react-query";

export type ForecastLevel = "low" | "moderate" | "high";

export interface ForecastPoint {
  timestamp: string;
  value: number;
  lower: number;
  upper: number;
}

export interface ForecastSummary {
  currentValue: number;
  level: ForecastLevel;
  changeNext24h: number;
  dominantPollutantKey: string;
  peakValue: number;
  peakTimestamp: string;
}

export interface ForecastSnapshot {
  updatedAt: string;
  points: ForecastPoint[];
  summary: ForecastSummary;
}

export const FORECAST_LEVEL_LABELS: Record<ForecastLevel, string> = {
  low: "forecast_level_low",
  moderate: "forecast_level_moderate",
  high: "forecast_level_high",
};

const FORECAST_HOURS = 72;
const FORECAST_STEP_HOURS = 1;
const HOUR_IN_MS = 60 * 60 * 1000;
const FORECAST_PERIOD_MS = 12 * HOUR_IN_MS;

const DOMINANT_KEYS = ["metric_PM2_5", "metric_Noise", "metric_Radiation"] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeForecastValue(timestamp: number): number {
  const diurnal = Math.sin(timestamp / FORECAST_PERIOD_MS) * 18;
  const mesoscale = Math.sin(timestamp / (FORECAST_PERIOD_MS / 2) + Math.PI / 4) * 8;
  const micro = Math.cos(timestamp / (FORECAST_PERIOD_MS / 3) + Math.PI / 6) * 4;
  const baseline = 60;
  return clamp(baseline + diurnal + mesoscale + micro, 18, 165);
}

function buildForecastSnapshot(): ForecastSnapshot {
  const now = Date.now();

  const points = Array.from({ length: FORECAST_HOURS + 1 }, (_, index) => {
    const timestamp = now + index * FORECAST_STEP_HOURS * HOUR_IN_MS;
    const value = computeForecastValue(timestamp);
    const spreadBase = 10 + Math.abs(Math.sin(timestamp / (FORECAST_PERIOD_MS / 1.5))) * 6;
    const lower = clamp(value - spreadBase, 10, 150);
    const upper = clamp(value + spreadBase, 20, 175);
    return {
      timestamp: new Date(timestamp).toISOString(),
      value: Math.round(value),
      lower: Math.round(lower),
      upper: Math.round(upper),
    };
  });

  const current = points[0];
  const dayAhead = points[Math.min(24, points.length - 1)];

  const peak = points.reduce(
    (acc, point) => (point.value > acc.value ? point : acc),
    current,
  );

  const changeNext24h = Math.round(dayAhead.value - current.value);
  const level = resolveForecastLevel(current.value);
  const dominantPollutantKey = resolveDominantPollutantKey(now);

  return {
    updatedAt: new Date(now).toISOString(),
    points,
    summary: {
      currentValue: current.value,
      level,
      changeNext24h,
      dominantPollutantKey,
      peakValue: peak.value,
      peakTimestamp: peak.timestamp,
    },
  };
}

function resolveForecastLevel(value: number): ForecastLevel {
  if (value <= 50) return "low";
  if (value <= 100) return "moderate";
  return "high";
}

function resolveDominantPollutantKey(timestamp: number): string {
  const windowIndex = Math.floor(timestamp / (3 * HOUR_IN_MS)) % DOMINANT_KEYS.length;
  return DOMINANT_KEYS[windowIndex];
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useForecastData() {
  return useQuery({
    queryKey: ["forecast", "aqi"],
    queryFn: async () => {
      await wait(200);
      return buildForecastSnapshot();
    },
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
    staleTime: 30 * 1000,
  });
}
