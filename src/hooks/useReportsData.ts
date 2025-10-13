import { subHours, subDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";

export type ReportStatus = "open" | "investigating" | "resolved";
export type ReportType = "illegal_dumping" | "water_pollution" | "air_quality" | "radiation";

export interface ReportIncident {
  id: string;
  titleKey: string;
  descriptionKey: string;
  type: ReportType;
  status: ReportStatus;
  timestamp: string;
  coordinates: [number, number];
}

export interface ReportsSnapshot {
  incidents: ReportIncident[];
  updatedAt: string;
  types: { id: ReportType; labelKey: string }[];
  statuses: { id: ReportStatus; labelKey: string }[];
}

const incidentsSeed: ReportIncident[] = [
  {
    id: "report-001",
    titleKey: "reports_dumping_pechersk_title",
    descriptionKey: "reports_dumping_pechersk_description",
    type: "illegal_dumping",
    status: "open",
    timestamp: subHours(new Date(), 6).toISOString(),
    coordinates: [50.4258, 30.5594],
  },
  {
    id: "report-002",
    titleKey: "reports_water_dnipro_title",
    descriptionKey: "reports_water_dnipro_description",
    type: "water_pollution",
    status: "investigating",
    timestamp: subHours(new Date(), 18).toISOString(),
    coordinates: [48.467, 35.0461],
  },
  {
    id: "report-003",
    titleKey: "reports_air_kharkiv_title",
    descriptionKey: "reports_air_kharkiv_description",
    type: "air_quality",
    status: "open",
    timestamp: subHours(new Date(), 3).toISOString(),
    coordinates: [49.9935, 36.2304],
  },
  {
    id: "report-004",
    titleKey: "reports_radiation_chernobyl_title",
    descriptionKey: "reports_radiation_chernobyl_description",
    type: "radiation",
    status: "resolved",
    timestamp: subDays(new Date(), 1).toISOString(),
    coordinates: [51.2765, 30.2215],
  },
  {
    id: "report-005",
    titleKey: "reports_dumping_odessa_title",
    descriptionKey: "reports_dumping_odessa_description",
    type: "illegal_dumping",
    status: "investigating",
    timestamp: subHours(new Date(), 12).toISOString(),
    coordinates: [46.4825, 30.7233],
  },
  {
    id: "report-006",
    titleKey: "reports_water_lviv_title",
    descriptionKey: "reports_water_lviv_description",
    type: "water_pollution",
    status: "resolved",
    timestamp: subHours(new Date(), 30).toISOString(),
    coordinates: [49.8397, 24.0297],
  },
];

const reportTypes = [
  { id: "illegal_dumping", labelKey: "reports_type_dumping" },
  { id: "water_pollution", labelKey: "reports_type_water" },
  { id: "air_quality", labelKey: "reports_type_air" },
  { id: "radiation", labelKey: "reports_type_radiation" },
] as const;

const reportStatuses = [
  { id: "open", labelKey: "reports_status_open" },
  { id: "investigating", labelKey: "reports_status_investigating" },
  { id: "resolved", labelKey: "reports_status_resolved" },
] as const;

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useReportsData() {
  return useQuery({
    queryKey: ["reports", "incidents"],
    queryFn: async () => {
      await wait(200);
      return {
        incidents: incidentsSeed,
        updatedAt: new Date().toISOString(),
        types: reportTypes.map((item) => ({ ...item })),
        statuses: reportStatuses.map((item) => ({ ...item })),
      } satisfies ReportsSnapshot;
    },
    staleTime: 60 * 1000,
  });
}
