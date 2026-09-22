import {
  Building2,
  FileText,
  Fingerprint,
  Globe,
  KeyRound,
  LayoutDashboard,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Section heading in the sidebar; omitted for the primary group. */
  label?: string;
  adminOnly?: boolean;
  items: NavItem[];
}

/** Single source for the sidebar navigation. */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/clients", label: "Clients", icon: Building2 },
      { to: "/credentials", label: "Credentials", icon: KeyRound },
      { to: "/tenders", label: "Tenders", icon: FileText },
      { to: "/dsc", label: "DSC Keys", icon: Fingerprint },
    ],
  },
  {
    label: "Administration",
    adminOnly: true,
    items: [
      // A record module rather than a master list, but admin-only (CH-27),
      // so it lives in the group that is hidden from employees entirely.
      { to: "/expenses", label: "Expenses", icon: Wallet },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/portals", label: "Portals", icon: Globe },
      { to: "/admin/tender-departments", label: "Tender Departments", icon: Tags },
    ],
  },
];
