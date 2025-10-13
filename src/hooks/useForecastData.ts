import { addHours } from "date-fns";
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

let forecastSeries: ForecastPoint[] = initializeForecastSeries();

function initializeForecastSeries(): ForecastPoint[] {
  const now = new Date();
  return Array.from({ length: FORECAST_HOURS + 1 }, (_, index) => {
    const timestamp = addHours(now, index * FORECAST_STEP_HOURS);
    const wave = Math.sin((index / 24) * Math.PI);
    const base = 48 + wave * 18;
    const jitter = randomBetween(-6, 6);
    const value = clamp(base + jitter, 18, 160);
    const spread = 10 + Math.abs(wave) * 6;
    const lower = clamp(value - spread, 10, 140);
    const upper = clamp(value + spread, 20, 170);
    return {
      timestamp: timestamp.toISOString(),
      value: Math.round(value),
      lower: Math.round(lower),
      upper: Math.round(upper),
    };
  });
}

function updateForecastSeries(): void {
  forecastSeries = forecastSeries.map((point, index) => {
    if (index === 0) {
      const drift = randomBetween(-4, 4);
      const value = clamp(point.value + drift, 18, 150);
      const spread = clamp(point.upper - point.lower, 8, 24);
      return {
        ...point,
        value: Math.round(value),
        lower: Math.round(clamp(value - spread / 2, 10, value)),
        upper: Math.round(clamp(value + spread / 2, value, 170)),
      };
    }

    const drift = randomBetween(-3, 3);
    const value = clamp(point.value + drift, 18, 160);
    const spread = clamp(point.upper - point.lower, 12, 26);
    const lower = clamp(value - spread / 2, 10, 150);
    const upper = clamp(value + spread / 2, 20, 172);

    return {
      ...point,
      value: Math.round(value),
      lower: Math.round(lower),
      upper: Math.round(upper),
    };
  });
}

function buildForecastSnapshot(): ForecastSnapshot {
  updateForecastSeries();

  const nowPoint = forecastSeries[0];
  const dayAheadPoint = forecastSeries[Math.min(24, forecastSeries.length - 1)];

  const peak = forecastSeries.reduce(
    (acc, point) => (point.value > acc.value ? { value: point.value, timestamp: point.timestamp } : acc),
    { value: nowPoint.value, timestamp: nowPoint.timestamp },
  );

  const changeNext24h = Math.round(dayAheadPoint.value - nowPoint.value);
  const level = resolveForecastLevel(nowPoint.value);
  const dominantPollutantKey = resolveDominantPollutantKey();

  return {
    updatedAt: new Date().toISOString(),
    points: forecastSeries,
    summary: {
      currentValue: nowPoint.value,
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

const DOMINANT_KEYS = ["metric_PM2_5", "metric_Noise", "metric_Radiation"] as const;

function resolveDominantPollutantKey(): string {
  const index = Math.floor(Date.now() / (3 * 60 * 60 * 1000)) % DOMINANT_KEYS.length;
  return DOMINANT_KEYS[index];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
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
