import { Activity, UserRound } from "lucide-react";

export const navItems = [
  { href: "/", labelKey: "nav.services", icon: Activity },
  { href: "/profile", labelKey: "nav.profile", icon: UserRound }
] as const;
