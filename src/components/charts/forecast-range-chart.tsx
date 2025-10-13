import type { JSX } from "react";
import { useId, useMemo } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ForecastPoint } from "@/hooks/useForecastData";

interface ForecastRangeChartProps {
  data: ForecastPoint[];
}

export function ForecastRangeChart({ data }: ForecastRangeChartProps): JSX.Element {
  const bandGradientId = useId();
  const lineGradientId = useId();

  const formatted = useMemo(
    () =>
      data.map((point) => {
        const timestamp = new Date(point.timestamp);
        return {
          ...point,
          label: format(timestamp, "EEE HH:mm"),
          range: point.upper - point.lower,
        };
      }),
    [data],
  );

  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={formatted} margin={{ top: 16, right: 20, left: 20, bottom: 12 }}>
          <defs>
            <linearGradient id={bandGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.08} />
            </linearGradient>
            <linearGradient id={lineGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#facc15" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            interval={5}
            minTickGap={24}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={40}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              borderRadius: "0.75rem",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--popover-foreground))",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            formatter={(value: number, key: string) => {
              if (key === "range") {
                return [`±${Math.round(value / 2)}`, "CI"];
              }
              return [Math.round(value), "AQI"];
            }}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stackId="confidence"
            stroke="transparent"
            fill="transparent"
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="range"
            stackId="confidence"
            stroke="none"
            fill={`url(#${bandGradientId})`}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={`url(#${lineGradientId})`}
            strokeWidth={3}
            strokeDasharray="4 1"
            fill="none"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#34d399" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
