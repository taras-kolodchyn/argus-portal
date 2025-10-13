import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheck,
  Filter,
  Info,
} from "lucide-react";

import { IncidentMap } from "@/components/maps/incident-map";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useReportsData,
  type ReportIncident,
  type ReportStatus,
  type ReportType,
} from "@/hooks/useReportsData";
import { cn } from "@/lib/utils";

const statusStyles: Record<ReportStatus, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  investigating: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};

const typeAccent: Record<ReportType, string> = {
  illegal_dumping: "border-red-400/60",
  water_pollution: "border-sky-400/60",
  air_quality: "border-primary/60",
  radiation: "border-purple-400/60",
};

export function ReportsPage(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading } = useReportsData();

  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<ReportIncident | null>(null);

  const incidents = useMemo(() => data?.incidents ?? [], [data?.incidents]);

  const filtered = useMemo(
    () =>
      incidents.filter((incident) => {
        const matchType = typeFilter === "all" || incident.type === typeFilter;
        const matchStatus = statusFilter === "all" || incident.status === statusFilter;
        return matchType && matchStatus;
      }),
    [incidents, statusFilter, typeFilter],
  );

  const lastUpdated = data?.updatedAt
    ? formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4 text-primary" />
              {t("reports_title")}
            </CardTitle>
            <CardDescription>{t("reports_description")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label={t("reports_filter_type")}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as ReportType | "all")}
              options={[
                { id: "all", label: t("reports_filter_all_types") },
                ...(data?.types.map((item) => ({
                  id: item.id,
                  label: t(item.labelKey),
                })) ?? []),
              ]}
            />
            <FilterSelect
              label={t("reports_filter_status")}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as ReportStatus | "all")}
              options={[
                { id: "all", label: t("reports_filter_all_status") },
                ...(data?.statuses.map((item) => ({
                  id: item.id,
                  label: t(item.labelKey),
                })) ?? []),
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.6fr,1fr]">
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">{t("reports_loading")}</div>
            ) : (
              <IncidentMap
                incidents={filtered}
                selectedId={selectedId}
                onSelect={(incident) => setSelectedId(incident.id)}
              />
            )}
          </div>
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                {t("reports_empty_state")}
              </div>
            ) : (
              filtered.map((incident) => (
                <IncidentListItem
                  key={incident.id}
                  incident={incident}
                  onViewDetails={() => setActiveIncident(incident)}
                  isSelected={incident.id === selectedId}
                />
              ))
            )}
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          <span>
            <Filter className="mr-2 inline h-3.5 w-3.5" />
            {lastUpdated ? t("last_updated", { value: lastUpdated }) : t("reports_loading")}
          </span>
        </CardFooter>
      </Card>

      <Dialog
        open={Boolean(activeIncident)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveIncident(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeIncident ? t(activeIncident.titleKey) : ""}</DialogTitle>
            <DialogDescription>
              {activeIncident ? t(`reports_status_${activeIncident.status}`) : ""}
            </DialogDescription>
          </DialogHeader>
          {activeIncident && (
            <div className="space-y-4 text-sm">
              <p className="leading-relaxed text-muted-foreground">
                {t(activeIncident.descriptionKey)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusStyles[activeIncident.status]}>
                  {t(`reports_status_${activeIncident.status}`)}
                </Badge>
                <Badge variant="outline">
                  {t(`reports_type_badge_${activeIncident.type}`)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("reports_reported_at", {
                  value: formatDistanceToNow(new Date(activeIncident.timestamp), {
                    addSuffix: true,
                  }),
                })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function IncidentListItem({
  incident,
  onViewDetails,
  isSelected,
}: {
  incident: ReportIncident;
  onViewDetails: () => void;
  isSelected: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const timeAgo = formatDistanceToNow(new Date(incident.timestamp), { addSuffix: true });

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-sm transition-colors",
        typeAccent[incident.type],
        isSelected ? "bg-card" : "bg-card/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold leading-tight">{t(incident.titleKey)}</h3>
          <p className="text-xs text-muted-foreground">
            {t(`reports_type_badge_${incident.type}`)} ·{" "}
            {t("reports_reported_at", { value: timeAgo })}
          </p>
        </div>
        <Badge className={cn("rounded-full px-3 py-1 text-xs", statusStyles[incident.status])}>
          {t(`reports_status_${incident.status}`)}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {t(incident.descriptionKey)}
        </p>
        <Button variant="ghost" size="sm" onClick={onViewDetails} className="text-xs font-medium">
          <Info className="mr-2 h-4 w-4" />
          {t("reports_view_details")}
        </Button>
      </div>
    </div>
  );
}
