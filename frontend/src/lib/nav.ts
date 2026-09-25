import {
  Building2,
  FileText,
  Fingerprint,
  Globe,
  Landmark,
  KeyRound,
  LayoutDashboard,
  Menu,
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

export interface TabItem extends NavItem {
  /** `end` matching, so More doesn't stay lit on the pages it links to. */
  end?: boolean;
}

/**
 * The phone's bottom tab bar (CH-30): the three destinations people reach for,
 * plus More for everything else. Derived from the same nav vocabulary as the
 * desktop rail below, and deliberately four — five is the point where labels
 * start truncating at 360px.
 */
export const primaryTabs: TabItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Building2 },
  { to: "/tenders", label: "Tenders", icon: FileText },
  { to: "/more", label: "More", icon: Menu, end: true },
];

/** Single source for the sidebar navigation. */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/clients", label: "Clients", icon: Building2 },
      { to: "/credentials", label: "Credentials", icon: KeyRound },
      { to: "/tenders", label: "Tenders", icon: FileText },
      { to: "/emd", label: "EMD", icon: Landmark },
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
