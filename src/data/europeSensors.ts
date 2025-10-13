interface SensorReading {
  metric: "AQI" | "PM2.5" | "Radiation" | "Water" | "Noise";
  value: number;
  unit: string;
}

interface SensorLocation {
  id: string;
  name: string;
  status: "online" | "offline" | "maintenance";
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  readings: SensorReading[];
  primaryMetric: SensorReading;
}

interface BaseCity {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

const baseCities: BaseCity[] = [
  { city: "Lisbon", country: "Portugal", latitude: 38.7223, longitude: -9.1393 },
  { city: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038 },
  { city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { city: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
  { city: "Vienna", country: "Austria", latitude: 48.2082, longitude: 16.3738 },
  { city: "Prague", country: "Czechia", latitude: 50.0755, longitude: 14.4378 },
  { city: "Warsaw", country: "Poland", latitude: 52.2297, longitude: 21.0122 },
  { city: "Budapest", country: "Hungary", latitude: 47.4979, longitude: 19.0402 },
  { city: "Rome", country: "Italy", latitude: 41.9028, longitude: 12.4964 },
  { city: "Milan", country: "Italy", latitude: 45.4642, longitude: 9.19 },
  { city: "Athens", country: "Greece", latitude: 37.9838, longitude: 23.7275 },
  { city: "Stockholm", country: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { city: "Oslo", country: "Norway", latitude: 59.9139, longitude: 10.7522 },
  { city: "Copenhagen", country: "Denmark", latitude: 55.6761, longitude: 12.5683 },
  { city: "Helsinki", country: "Finland", latitude: 60.1699, longitude: 24.9384 },
  { city: "Dublin", country: "Ireland", latitude: 53.3498, longitude: -6.2603 },
  { city: "Amsterdam", country: "Netherlands", latitude: 52.3676, longitude: 4.9041 },
  { city: "Brussels", country: "Belgium", latitude: 50.8503, longitude: 4.3517 },
  { city: "Zurich", country: "Switzerland", latitude: 47.3769, longitude: 8.5417 },
  { city: "Reykjavík", country: "Iceland", latitude: 64.1466, longitude: -21.9426 },
  { city: "Tallinn", country: "Estonia", latitude: 59.437, longitude: 24.7536 },
  { city: "Riga", country: "Latvia", latitude: 56.9496, longitude: 24.1052 },
  { city: "Vilnius", country: "Lithuania", latitude: 54.6872, longitude: 25.2797 },
  { city: "Bucharest", country: "Romania", latitude: 44.4268, longitude: 26.1025 },
  { city: "Sofia", country: "Bulgaria", latitude: 42.6977, longitude: 23.3219 },
  { city: "Belgrade", country: "Serbia", latitude: 44.7866, longitude: 20.4489 },
  { city: "Zagreb", country: "Croatia", latitude: 45.815, longitude: 15.9819 },
  { city: "Ljubljana", country: "Slovenia", latitude: 46.0569, longitude: 14.5058 },
  { city: "Sarajevo", country: "Bosnia & Herzegovina", latitude: 43.8563, longitude: 18.4131 },
  { city: "Skopje", country: "North Macedonia", latitude: 41.9981, longitude: 21.4254 },
  { city: "Podgorica", country: "Montenegro", latitude: 42.4304, longitude: 19.2594 },
  { city: "Tirana", country: "Albania", latitude: 41.3275, longitude: 19.8187 },
  { city: "Ankara", country: "Turkey", latitude: 39.9334, longitude: 32.8597 },
  { city: "Istanbul", country: "Turkey", latitude: 41.0082, longitude: 28.9784 },
  { city: "Kyiv", country: "Ukraine", latitude: 50.4501, longitude: 30.5234 },
  { city: "Lviv", country: "Ukraine", latitude: 49.8397, longitude: 24.0297 },
  { city: "Odessa", country: "Ukraine", latitude: 46.4825, longitude: 30.7233 },
  { city: "Chişinău", country: "Moldova", latitude: 47.0105, longitude: 28.8638 },
  { city: "Tbilisi", country: "Georgia", latitude: 41.7151, longitude: 44.8271 },
  { city: "Yerevan", country: "Armenia", latitude: 40.1792, longitude: 44.4991 },
  { city: "Baku", country: "Azerbaijan", latitude: 40.4093, longitude: 49.8671 }
];

const metrics: { metric: SensorReading["metric"]; unit: string; min: number; max: number }[] = [
  { metric: "AQI", unit: "US AQI", min: 12, max: 140 },
  { metric: "PM2.5", unit: "µg/m³", min: 3, max: 120 },
  { metric: "Radiation", unit: "µSv/h", min: 0.05, max: 0.4 },
  { metric: "Water", unit: "pH", min: 6.5, max: 8.2 },
  { metric: "Noise", unit: "dB", min: 38, max: 95 },
];

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const sensors: SensorLocation[] = (() => {
  const list: SensorLocation[] = [];
  const rand = seededRandom(20250212);
  const now = Date.now();

  for (let i = 0; i < 1000; i += 1) {
    const city = baseCities[i % baseCities.length];
    const offsetLat = (rand() - 0.5) * 0.6;
    const offsetLng = (rand() - 0.5) * 0.6;
    const statusRoll = rand();
    const status: SensorLocation["status"] =
      statusRoll > 0.9 ? "maintenance" : statusRoll > 0.8 ? "offline" : "online";

    const readingCount = 2 + Math.floor(rand() * 4);
    const availableMetrics = [...metrics];
    const readings: SensorReading[] = [];

    for (let j = 0; j < readingCount && availableMetrics.length > 0; j += 1) {
      const index = Math.floor(rand() * availableMetrics.length);
      const [metric] = availableMetrics.splice(index, 1);
      const value = metric.min + rand() * (metric.max - metric.min);
      const precision = metric.metric === "Radiation" ? 3 : metric.metric === "Water" ? 2 : 1;
      readings.push({
        metric: metric.metric,
        unit: metric.unit,
        value: Number(value.toFixed(precision)),
      });
    }

    const updatedAt = new Date(now - rand() * 1000 * 60 * 60 * 24).toISOString();

    list.push({
      id: `sensor-${i + 1}`,
      name: `Env Hub ${i + 1}`,
      status,
      city: city.city,
      country: city.country,
      latitude: city.latitude + offsetLat,
      longitude: city.longitude + offsetLng,
      updatedAt,
      readings,
      primaryMetric: readings[0],
    });
  }

  return list;
})();

export type { SensorLocation, SensorReading };
export { sensors as europeSensors };
