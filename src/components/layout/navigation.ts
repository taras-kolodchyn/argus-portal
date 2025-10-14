import {
  BellRing,
  FileBarChart2,
  GitCompare,
  LayoutDashboard,
  MapPinned,
  ServerCog,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    labelKey: "dashboard",
    to: "/",
  },
  {
    icon: FileBarChart2,
    labelKey: "forecast",
    to: "/forecast",
  },
  {
    icon: GitCompare,
    labelKey: "compare",
    to: "/compare",
  },
  {
    icon: ServerCog,
    labelKey: "devices",
    to: "/devices",
  },
  {
    icon: BellRing,
    labelKey: "notifications",
    to: "/notifications",
  },
  {
    icon: MapPinned,
    labelKey: "reports",
    to: "/reports",
  },
  {
    icon: UserCircle2,
    labelKey: "profile",
    to: "/profile",
  },
];
