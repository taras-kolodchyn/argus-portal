import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AqiPoint } from "@/hooks/useDashboardData";

interface Props {
  data: AqiPoint[];
}

export function AqiTrendChart({ data }: Props): JSX.Element {
  const { t } = useTranslation();

  const formattedData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        label: format(new Date(point.timestamp), "HH:mm"),
      })),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formattedData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            borderRadius: "0.75rem",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--popover-foreground))",
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          formatter={(value: number) => [`${value}`, t("metric_units_aqi")]}>
          </Tooltip>
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
