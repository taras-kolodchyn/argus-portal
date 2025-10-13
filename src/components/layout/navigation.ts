import {
  Globe2,
  BellRing,
  LayoutDashboard,
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
    icon: ServerCog,
    labelKey: "devices",
    to: "/devices",
  },
  {
    icon: Globe2,
    labelKey: "world_map",
    to: "/world-map",
  },
  {
    icon: BellRing,
    labelKey: "notifications",
    to: "/notifications",
  },
  {
    icon: UserCircle2,
    labelKey: "profile",
    to: "/profile",
  },
];
