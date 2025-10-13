import KDBush from "kdbush";
import type { Feature, FeatureCollection, Point } from "geojson";

type MetricType = "AQI" | "PM2.5" | "Radiation" | "Water" | "Noise";
export type DeviceStatus = "online" | "offline" | "maintenance";

export interface DeviceReading {
  metric: MetricType;
  value: number;
  unit: string;
}

export interface DeviceProperties {
  id: string;
  name: string;
  status: DeviceStatus;
  city: string;
  country: string;
  readings: DeviceReading[];
  updatedAt: string;
}

export type DeviceFeature = Feature<Point, DeviceProperties>;

export interface DeviceDataset {
  features: DeviceFeature[];
  index: KDBush<DeviceFeature>;
  summary: Summary;
}

export interface Summary {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  metrics: Record<MetricType, { average: number; min: number; max: number }>;
}

interface MetricConfig {
  metric: MetricType;
  unit: string;
  min: number;
  max: number;
}

const METRICS: MetricConfig[] = [
  { metric: "AQI", unit: "US AQI", min: 5, max: 220 },
  { metric: "PM2.5", unit: "µg/m³", min: 1, max: 180 },
  { metric: "Radiation", unit: "µSv/h", min: 0.04, max: 0.7 },
  { metric: "Water", unit: "pH", min: 6.2, max: 8.8 },
  { metric: "Noise", unit: "dB", min: 30, max: 110 },
];

interface CitySeed {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

const CITY_SEEDS: CitySeed[] = [
  { name: "Lisbon", country: "Portugal", latitude: 38.7223, longitude: -9.1393 },
  { name: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { name: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
  { name: "Vienna", country: "Austria", latitude: 48.2082, longitude: 16.3738 },
  { name: "Prague", country: "Czechia", latitude: 50.0755, longitude: 14.4378 },
  { name: "Warsaw", country: "Poland", latitude: 52.2297, longitude: 21.0122 },
  { name: "Budapest", country: "Hungary", latitude: 47.4979, longitude: 19.0402 },
  { name: "Rome", country: "Italy", latitude: 41.9028, longitude: 12.4964 },
  { name: "Milan", country: "Italy", latitude: 45.4642, longitude: 9.19 },
  { name: "Athens", country: "Greece", latitude: 37.9838, longitude: 23.7275 },
  { name: "Stockholm", country: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { name: "Copenhagen", country: "Denmark", latitude: 55.6761, longitude: 12.5683 },
  { name: "Helsinki", country: "Finland", latitude: 60.1699, longitude: 24.9384 },
  { name: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603 },
  { name: "Amsterdam", country: "Netherlands", latitude: 52.3676, longitude: 4.9041 },
  { name: "Brussels", country: "Belgium", latitude: 50.8503, longitude: 4.3517 },
  { name: "Zurich", country: "Switzerland", latitude: 47.3769, longitude: 8.5417 },
  { name: "Reykjavik", country: "Iceland", latitude: 64.1466, longitude: -21.9426 },
  { name: "Kyiv", country: "Ukraine", latitude: 50.4501, longitude: 30.5234 },
  { name: "Lviv", country: "Ukraine", latitude: 49.8397, longitude: 24.0297 },
  { name: "Odessa", country: "Ukraine", latitude: 46.4825, longitude: 30.7233 },
  { name: "Tbilisi", country: "Georgia", latitude: 41.7151, longitude: 44.8271 },
  { name: "Yerevan", country: "Armenia", latitude: 40.1792, longitude: 44.4991 },
  { name: "Baku", country: "Azerbaijan", latitude: 40.4093, longitude: 49.8671 }
];

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function generateDataset(count: number, seed = 20250212): DeviceDataset {
  const label = `dataset:${count}`;
  console.time(label);
  console.log(`[generator] Building ${count.toLocaleString()} synthetic devices...`);
  const rand = seededRandom(seed);
  const features: DeviceFeature[] = [];
  const metricStats: Summary["metrics"] = {
    AQI: { average: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    "PM2.5": { average: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    Radiation: { average: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    Water: { average: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    Noise: { average: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
  };

  let online = 0;
  let offline = 0;
  let maintenance = 0;

  const logEvery = Math.max(1, Math.floor(count / 20));
  for (let i = 0; i < count; i += 1) {
    const city = CITY_SEEDS[i % CITY_SEEDS.length];
    const jitterLat = (rand() - 0.5) * 0.8;
    const jitterLng = (rand() - 0.5) * 0.8;
    const statusRoll = rand();
    const status: DeviceStatus = statusRoll > 0.93 ? "maintenance" : statusRoll > 0.85 ? "offline" : "online";
    if (status === "online") online += 1;
    else if (status === "offline") offline += 1;
    else maintenance += 1;

    const readingCount = 2 + Math.floor(rand() * 4);
    const availableMetrics = [...METRICS];
    const readings: DeviceReading[] = [];

    for (let j = 0; j < readingCount && availableMetrics.length > 0; j += 1) {
      const idx = Math.floor(rand() * availableMetrics.length);
      const [metric] = availableMetrics.splice(idx, 1);
      if (!metric) continue;
      const value = metric.min + rand() * (metric.max - metric.min);
      const precision = metric.metric === "Radiation" ? 3 : metric.metric === "Water" ? 2 : 1;
      const readingValue = Number(value.toFixed(precision));
      readings.push({ metric: metric.metric, unit: metric.unit, value: readingValue });

      const stats = metricStats[metric.metric];
      stats.average += readingValue;
      stats.min = Math.min(stats.min, readingValue);
      stats.max = Math.max(stats.max, readingValue);
    }

    if (readings.length === 0) {
      readings.push({ metric: "AQI", unit: "US AQI", value: Number((METRICS[0].min + rand() * 10).toFixed(1)) });
    }

    const feature: DeviceFeature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [city.longitude + jitterLng, city.latitude + jitterLat],
      },
      properties: {
        id: `device-${i + 1}`,
        name: `${city.name} Node ${i + 1}`,
        status,
        city: city.name,
        country: city.country,
        readings,
        updatedAt: new Date(Date.now() - rand() * 1000 * 60 * 60 * 24).toISOString(),
      },
    };
    features.push(feature);

    if ((i + 1) % logEvery === 0) {
      console.log(`[generator] ${(i + 1).toLocaleString()} devices prepared...`);
    }
  }

  const totals = features.length;
  (Object.keys(metricStats) as MetricType[]).forEach((metric) => {
    const stats = metricStats[metric];
    stats.average = Number((stats.average / totals).toFixed(2));
    if (!Number.isFinite(stats.min)) stats.min = 0;
    if (!Number.isFinite(stats.max)) stats.max = 0;
  });

  const index = new KDBush<DeviceFeature>(
    features,
    (feature) => feature.geometry.coordinates[0],
    (feature) => feature.geometry.coordinates[1],
  );

  const dataset: DeviceDataset = {
    features,
    index,
    summary: {
      total: totals,
      online,
      offline,
      maintenance,
      metrics: metricStats,
    },
  };

  console.timeEnd(label);
  return dataset;
}

export function featuresToCollection(features: DeviceFeature[]): FeatureCollection<Point, DeviceProperties> {
  return {
    type: "FeatureCollection",
    features,
  };
}

export type { DeviceFeature };
