import { subMinutes, subHours } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type NotificationSeverity = "critical" | "warning" | "info";

export interface NotificationRecord {
  id: string;
  titleKey: string;
  descriptionKey: string;
  severity: NotificationSeverity;
  timestamp: string;
  isRead: boolean;
}

type NotificationState = NotificationRecord[];

const seedNotifications: NotificationState = [
  {
    id: "notif-001",
    titleKey: "notification_radiation_spike_title",
    descriptionKey: "notification_radiation_spike_message",
    severity: "critical",
    timestamp: subMinutes(new Date(), 24).toISOString(),
    isRead: false,
  },
  {
    id: "notif-002",
    titleKey: "notification_noise_warning_title",
    descriptionKey: "notification_noise_warning_message",
    severity: "warning",
    timestamp: subMinutes(new Date(), 95).toISOString(),
    isRead: false,
  },
  {
    id: "notif-003",
    titleKey: "notification_water_quality_title",
    descriptionKey: "notification_water_quality_message",
    severity: "info",
    timestamp: subHours(new Date(), 4).toISOString(),
    isRead: false,
  },
  {
    id: "notif-004",
    titleKey: "notification_network_sync_title",
    descriptionKey: "notification_network_sync_message",
    severity: "info",
    timestamp: subHours(new Date(), 8).toISOString(),
    isRead: true,
  },
  {
    id: "notif-005",
    titleKey: "notification_aqi_improving_title",
    descriptionKey: "notification_aqi_improving_message",
    severity: "warning",
    timestamp: subHours(new Date(), 13).toISOString(),
    isRead: true,
  },
];

let notificationsState: NotificationState = seedNotifications;

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sortNotifications(state: NotificationState): NotificationState {
  return [...state].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function useNotificationsFeed() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      await wait(160);
      return sortNotifications(notificationsState);
    },
    refetchInterval: 45 * 1000,
    refetchIntervalInBackground: true,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await wait(200);
      notificationsState = notificationsState.map((notification) => ({
        ...notification,
        isRead: true,
      }));
      return sortNotifications(notificationsState);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["notifications"], data);
    },
  });
}
