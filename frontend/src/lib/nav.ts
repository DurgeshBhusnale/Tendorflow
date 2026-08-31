import {
  Building2,
  FileText,
  Fingerprint,
  Globe,
  KeyRound,
  LayoutDashboard,
  Tags,
  Users,
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
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/portals", label: "Portals", icon: Globe },
      { to: "/admin/tender-names", label: "Tender Names", icon: Tags },
    ],
  },
];
