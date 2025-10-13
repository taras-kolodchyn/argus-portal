import Fastify from "fastify";
import cors from "@fastify/cors";
import { generateDataset } from "./generator";
import type { DeviceDataset, DeviceFeature, MetricType } from "./generator";

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const DEVICE_COUNT = Number(process.env.DEVICE_COUNT ?? 10_000);
const dataset: DeviceDataset = generateDataset(DEVICE_COUNT);

function getFeaturesWithinBBox(
  bbox: [number, number, number, number],
  limit: number,
): DeviceFeature[] {
  const [west, south, east, north] = bbox;
  const ids = dataset.index.range(west, south, east, north);
  if (ids.length <= limit) {
    return ids.map((id) => dataset.features[id]);
  }

  const step = Math.ceil(ids.length / limit);
  const result: DeviceFeature[] = [];
  for (let i = 0; i < ids.length && result.length < limit; i += step) {
    const feature = dataset.features[ids[i]];
    if (feature) {
      result.push(feature);
    }
  }
  return result;
}

app.get("/health", async () => ({ status: "ok" }));

app.get<{
  Querystring: { bbox?: string; limit?: string };
}>("/api/sensors", async (request, reply) => {
  const { bbox: bboxParam, limit: limitParam } = request.query;

  if (!bboxParam) {
    reply.code(400);
    return { error: "bbox query is required" };
  }

  const parts = bboxParam.split(",").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    reply.code(400);
    return { error: "bbox must have four numeric values" };
  }

  const limit = Math.min(Number(limitParam ?? 8000), 20000);
  const features = getFeaturesWithinBBox(parts as [number, number, number, number], limit);

  return {
    sensors: features.map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.name,
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      status: feature.properties.status,
      city: feature.properties.city,
      country: feature.properties.country,
      readings: feature.properties.readings,
      primaryMetric: feature.properties.readings[0],
      updatedAt: feature.properties.updatedAt,
    })),
  };
});

app.get("/api/summary", async () => dataset.summary);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    console.log(`World map backend listening on http://${host}:${port}`);
    console.log(`Loaded ${dataset.summary.total.toLocaleString()} devices`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
