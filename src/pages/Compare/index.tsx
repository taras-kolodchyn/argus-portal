import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeftRight,
  Download,
  FileSpreadsheet,
  ImageDown,
  MapPin,
  Sparkles,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCompareData,
  useCompareMetrics,
  type CompareMetricDefinition,
  type ComparePoint,
  type CompareSummary,
} from "@/hooks/useCompareData";
import type { MetricId } from "@/hooks/useDashboardData";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

interface ExportState {
  type: "csv" | "png";
  inProgress: boolean;
}

export function ComparePage(): JSX.Element {
  const { t } = useTranslation();
  const metrics = useCompareMetrics();
  const { data, isLoading } = useCompareData();

  const [leftId, setLeftId] = useState<string | undefined>();
  const [rightId, setRightId] = useState<string | undefined>();
  const [activeMetric, setActiveMetric] = useState<MetricId>("aqi");
  const [exportState, setExportState] = useState<ExportState | null>(null);

  const palette = useMemo(() => getMetricPalette(activeMetric), [activeMetric]);

  useEffect(() => {
    if (!data || data.locations.length === 0) {
      return;
    }
    setLeftId((prev) => prev ?? data.locations[0]?.id);
    setRightId((prev) => prev ?? data.locations[1]?.id ?? data.locations[0]?.id);
  }, [data]);

  const leftLocation = data?.locations.find((location) => location.id === leftId);
  const rightLocation = data?.locations.find((location) => location.id === rightId);

  useEffect(() => {
    if (!metrics.find((metric) => metric.id === activeMetric)) {
      setActiveMetric(metrics[0]?.id ?? "aqi");
    }
  }, [activeMetric, metrics]);

  const leftDataset = leftId ? data?.datasets[leftId] : undefined;
  const rightDataset = rightId ? data?.datasets[rightId] : undefined;

  const chartData = useMemo(() => {
    if (!leftDataset || !rightDataset) {
      return [];
    }

    return alignDatasets(leftDataset, rightDataset, activeMetric);
  }, [leftDataset, rightDataset, activeMetric]);

  const lastUpdated = data?.updatedAt
    ? formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })
    : null;

  const handleExport = (type: "csv" | "png") => {
    setExportState({ type, inProgress: true });
    window.setTimeout(() => {
      setExportState(null);
    }, 1400);
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <ComparisonPanel
          label={t("compare_panel_left")}
          locations={data?.locations ?? []}
          metrics={metrics}
          selectedId={leftId}
          onSelect={setLeftId}
          accent="var(--primary)"
          isLoading={isLoading}
        />
        <ComparisonPanel
          label={t("compare_panel_right")}
          locations={data?.locations ?? []}
          metrics={metrics}
          selectedId={rightId}
          onSelect={setRightId}
          accent="var(--accent)"
          isLoading={isLoading}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              {t("compare_trend_title")}
            </CardTitle>
            <CardDescription>
              {t("compare_trend_description")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <Button
                key={metric.id}
                variant={metric.id === activeMetric ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveMetric(metric.id)}
              >
                {t(metric.labelKey)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {chartData.length === 0 ? (
            <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              {t("compare_chart_empty")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
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
                  formatter={(value: number, key: string) => [
                    value,
                    key === "left" ? leftLocation?.name ?? "A" : rightLocation?.name ?? "B",
                  ]}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "12px",
                    color: "hsl(var(--muted-foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="left"
                  stroke={palette.left}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, stroke: palette.left, fill: palette.left }}
                  name={leftLocation?.name ?? t("compare_location_a")}
                />
                <Line
                  type="monotone"
                  dataKey="right"
                  stroke={palette.right}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={{ r: 3, strokeWidth: 0, stroke: palette.right, fill: palette.right }}
                  name={rightLocation?.name ?? t("compare_location_b")}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("csv")}
              disabled={exportState?.inProgress}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exportState?.type === "csv" && exportState.inProgress
                ? t("compare_exporting_csv")
                : t("compare_export_csv")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("png")}
              disabled={exportState?.inProgress}
            >
              <ImageDown className="mr-2 h-4 w-4" />
              {exportState?.type === "png" && exportState.inProgress
                ? t("compare_exporting_png")
                : t("compare_export_png")}
            </Button>
          </div>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            {lastUpdated ? t("last_updated", { value: lastUpdated }) : t("compare_loading")}
          </span>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("compare_table_title")}
          </CardTitle>
          <CardDescription>{t("compare_table_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("metric")}</TableHead>
                <TableHead>{leftLocation?.name ?? t("compare_location_a")}</TableHead>
                <TableHead>{rightLocation?.name ?? t("compare_location_b")}</TableHead>
                <TableHead>{t("compare_difference")}</TableHead>
                <TableHead className="text-right">{t("compare_advantage")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((metric) => (
                <TableRow key={`table-${metric.id}`}>
                  <TableCell className="font-medium">{t(metric.labelKey)}</TableCell>
                  <TableCell>{formatMetricValue(leftLocation, metric)}</TableCell>
                  <TableCell>{formatMetricValue(rightLocation, metric)}</TableCell>
                  <TableCell>{formatDifference(leftLocation, rightLocation, metric)}</TableCell>
                  <TableCell className="text-right">
                    {renderAdvantageBadge(leftLocation, rightLocation, metric, t)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface ComparisonPanelProps {
  label: string;
  locations: CompareSummary[];
  metrics: CompareMetricDefinition[];
  selectedId?: string;
  onSelect: (value: string) => void;
  accent: string;
  isLoading: boolean;
}

function ComparisonPanel({
  label,
  locations,
  metrics,
  selectedId,
  onSelect,
  accent,
  isLoading,
}: ComparisonPanelProps): JSX.Element {
  const { t } = useTranslation();
  const location = locations.find((item) => item.id === selectedId);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">{label}</CardTitle>
            <CardDescription>{t("compare_panel_description")}</CardDescription>
          </div>
          <Badge
            style={{ backgroundColor: accent }}
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white dark:text-white"
          >
            {location?.type ? t(`compare_type_${location.type}`) : t("compare_type_unknown")}
          </Badge>
        </div>
        <Select value={selectedId} onValueChange={onSelect} disabled={isLoading}>
          <SelectTrigger>
            <SelectValue placeholder={t("compare_select_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {location ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{location.region}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <div
                  key={`${location.id}-${metric.id}`}
                  className="rounded-lg border border-border bg-card/60 px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground">{t(metric.labelKey)}</p>
                  <p className="text-lg font-semibold">
                    {formatMetricValue(location, metric)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t(metric.unitKey)}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">{t("compare_loading")}</div>
        )}
      </CardContent>
    </Card>
  );
}

function alignDatasets(
  left: ComparePoint[],
  right: ComparePoint[],
  metric: MetricId,
): { timestamp: string; label: string; left: number; right: number }[] {
  return left.map((point, index) => {
    const rightPoint = right[index] ?? right[right.length - 1];
    return {
      timestamp: point.timestamp,
      label: format(new Date(point.timestamp), "HH:mm"),
      left: point.values[metric],
      right: rightPoint.values[metric],
    };
  });
}

function formatMetricValue(location: CompareSummary | undefined, metric: CompareMetricDefinition) {
  if (!location) {
    return "—";
  }
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });
  return formatter.format(location.metrics[metric.id]);
}

function formatDifference(
  left: CompareSummary | undefined,
  right: CompareSummary | undefined,
  metric: CompareMetricDefinition,
) {
  if (!left || !right) {
    return "—";
  }
  const difference = right.metrics[metric.id] - left.metrics[metric.id];
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: metric.decimals,
    maximumFractionDigits: metric.decimals,
  });

  if (difference === 0) {
    return formatter.format(0);
  }
  const formatted = formatter.format(Math.abs(difference));
  return difference > 0 ? `+${formatted}` : `-${formatted}`;
}

function renderAdvantageBadge(
  left: CompareSummary | undefined,
  right: CompareSummary | undefined,
  metric: CompareMetricDefinition,
  t: (key: string, options?: Record<string, unknown>) => string,
): JSX.Element {
  if (!left || !right) {
    return <span className="text-muted-foreground">—</span>;
  }

  const winner = determineWinner(left, right, metric);
  if (winner === "equal") {
    return (
      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
        {t("compare_advantage_equal")}
      </Badge>
    );
  }

  const name = winner === "left" ? left.name : right.name;
  const variant = winner === "left" ? "outline" : "outline";
  const className =
    winner === "left"
      ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-300"
      : "border-primary/60 text-primary";

  return (
    <Badge variant={variant} className={className}>
      {name}
    </Badge>
  );
}

function getMetricPalette(metric: MetricId): { left: string; right: string } {
  switch (metric) {
    case "aqi":
      return {
        left: "#22c55e",
        right: "#60a5fa",
      };
    case "noise":
      return {
        left: "#6366f1",
        right: "#a855f7",
      };
    case "radiation":
      return {
        left: "#22c55e",
        right: "#ef4444",
      };
    default:
      return {
        left: "#22c55e",
        right: "#60a5fa",
      };
  }
}

function determineWinner(
  left: CompareSummary,
  right: CompareSummary,
  metric: CompareMetricDefinition,
) {
  const leftValue = left.metrics[metric.id];
  const rightValue = right.metrics[metric.id];

  const tolerance = metric.decimals > 0 ? 0.05 : 1;

  if (Math.abs(leftValue - rightValue) <= tolerance) {
    return "equal";
  }

  if (metric.preferred === "lower") {
    return leftValue < rightValue ? "left" : "right";
  }

  return leftValue > rightValue ? "left" : "right";
}
