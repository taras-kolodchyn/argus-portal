import type { JSX } from "react";
import { useMemo } from "react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardMetric, MetricTrendPoint } from "@/hooks/useDashboardData";

interface EnvironmentTrendChartProps {
  metrics: DashboardMetric[];
  labels: Record<string, string>;
}

interface TrendDatum {
  timestamp: string;
  label: string;
  aqi?: number;
  noise?: number;
  radiation?: number;
}

const LINE_COLORS: Record<string, string> = {
  aqi: "#22c55e",
  noise: "#6366f1",
  radiation: "#ef4444",
};

export function EnvironmentTrendChart({ metrics, labels }: EnvironmentTrendChartProps): JSX.Element {
  const data = useMemo(() => generateTrendData(metrics), [metrics]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <RechartsTooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            borderRadius: "0.75rem",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--popover-foreground))",
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Legend
          wrapperStyle={{
            fontSize: "12px",
            color: "hsl(var(--muted-foreground))",
          }}
        />
        <Line
          type="monotone"
          dataKey="aqi"
          name={labels.aqi ?? "AQI"}
          stroke={LINE_COLORS.aqi}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="noise"
          name={labels.noise ?? "Noise"}
          stroke={LINE_COLORS.noise}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="radiation"
          name={labels.radiation ?? "Radiation"}
          stroke={LINE_COLORS.radiation}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function generateTrendData(metrics: DashboardMetric[]): TrendDatum[] {
  if (metrics.length === 0) {
    return [];
  }

  const baseTrend: MetricTrendPoint[] = metrics[0]?.trend ?? [];

  return baseTrend.map((point, index) => {
    const entry: TrendDatum = {
      timestamp: point.timestamp,
      label: format(new Date(point.timestamp), "HH:mm"),
    };

    metrics.forEach((metric) => {
      const reference = metric.trend[index] ?? metric.trend[metric.trend.length - 1];
      entry[metric.id] = reference?.value ?? metric.value;
    });

    return entry;
  });
}
