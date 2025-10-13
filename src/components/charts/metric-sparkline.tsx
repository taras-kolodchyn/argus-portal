import type { JSX } from "react";
import { useId, useMemo } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MetricTrendPoint } from "@/hooks/useDashboardData";

interface MetricSparklineProps {
  data: MetricTrendPoint[];
  color?: string;
  height?: number;
}

export function MetricSparkline({
  data,
  color = "var(--primary)",
  height = 120,
}: MetricSparklineProps): JSX.Element {
  const gradientId = useId();

  const formatted = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        label: format(new Date(point.timestamp), "HH:mm"),
      })),
    [data],
  );

  return (
    <div className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={formatted} margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="10%" stopColor={color} stopOpacity={0.35} />
              <stop offset="90%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <RechartsTooltip
            cursor={{ stroke: color, strokeOpacity: 0.3 }}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              borderRadius: "0.75rem",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--popover-foreground))",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            formatter={(value: number) => [value, ""]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
