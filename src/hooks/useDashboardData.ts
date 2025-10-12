import { addMinutes, formatDistanceToNow } from "date-fns";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

type MetricId = "aqi" | "noise" | "radiation" | "water";

export interface Metric {
  id: MetricId;
  labelKey: string;
  value: number;
  delta: number;
  unitKey: string;
}

export interface AqiPoint {
  timestamp: string;
  value: number;
}

export type DeviceStatus = "online" | "offline" | "maintenance";

export interface Device {
  id: string;
  name: string;
  location: string;
  status: DeviceStatus;
  lastSeen: string;
  serial: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
}

interface AddDevicePayload {
  serial: string;
  secret: string;
}

const metricsData: Metric[] = [
  {
    id: "aqi",
    labelKey: "metric_aqi",
    value: 42,
    delta: -4,
    unitKey: "metric_units_aqi",
  },
  {
    id: "noise",
    labelKey: "metric_noise",
    value: 58,
    delta: 2,
    unitKey: "metric_units_noise",
  },
  {
    id: "radiation",
    labelKey: "metric_radiation",
    value: 0.12,
    delta: 0.01,
    unitKey: "metric_units_radiation",
  },
  {
    id: "water",
    labelKey: "metric_water",
    value: 7.2,
    delta: -0.1,
    unitKey: "metric_units_water",
  },
];

const aqiSeries: AqiPoint[] = Array.from({ length: 12 }, (_, index) => {
  const base = new Date();
  const pointTime = addMinutes(base, index * -30);
  return {
    timestamp: pointTime.toISOString(),
    value: 35 + Math.round(Math.random() * 15),
  };
}).reverse();

let devicesStore: Device[] = [
  {
    id: "dev-1",
    name: "AQI-001",
    location: "Kyiv, Downtown",
    status: "online",
    lastSeen: formatDistanceToNow(addMinutes(new Date(), -5), {
      addSuffix: true,
    }),
    serial: "AQI-001",
  },
  {
    id: "dev-2",
    name: "NOISE-113",
    location: "Obolon",
    status: "maintenance",
    lastSeen: formatDistanceToNow(addMinutes(new Date(), -120), {
      addSuffix: true,
    }),
    serial: "NOI-113",
  },
  {
    id: "dev-3",
    name: "RAD-778",
    location: "Troieshchyna",
    status: "offline",
    lastSeen: formatDistanceToNow(addMinutes(new Date(), -240), {
      addSuffix: true,
    }),
    serial: "RAD-778",
  },
];

const notificationsData: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Noise threshold exceeded",
    description: "Device NOISE-113 recorded 85 dB for 15 minutes",
    severity: "warning",
    timestamp: addMinutes(new Date(), -90).toISOString(),
  },
  {
    id: "notif-2",
    title: "Radiation spike detected",
    description: "RAD-778 observed 0.25 µSv/h at 04:20",
    severity: "critical",
    timestamp: addMinutes(new Date(), -240).toISOString(),
  },
  {
    id: "notif-3",
    title: "New device paired",
    description: "AQI-001 paired successfully",
    severity: "info",
    timestamp: addMinutes(new Date(), -720).toISOString(),
  },
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard", "metrics"],
    queryFn: async () => {
      await wait(150);
      return metricsData;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAqiSeries() {
  return useQuery({
    queryKey: ["dashboard", "aqi"],
    queryFn: async () => {
      await wait(120);
      return aqiSeries;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      await wait(180);
      return devicesStore;
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      await wait(100);
      return notificationsData;
    },
  });
}

export function useAddDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serial }: AddDevicePayload) => {
      await wait(200);
      const newDevice: Device = {
        id: `dev-${Date.now()}`,
        name: serial.toUpperCase(),
        location: "Kyiv",
        status: "offline",
        lastSeen: formatDistanceToNow(new Date(), { addSuffix: true }),
        serial,
      };
      devicesStore = [newDevice, ...devicesStore];
      return newDevice;
    },
    onSuccess: () => refreshDevices(queryClient),
  });
}

function refreshDevices(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["devices"] }).catch(() => {
    // no-op for stale query
  });
}

