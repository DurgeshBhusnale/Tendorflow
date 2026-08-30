import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/credentials", label: "Credentials" },
  { to: "/tenders", label: "Tenders" },
  { to: "/dsc", label: "DSC Keys" },
];
const adminNavItems = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/portals", label: "Portals" },
  { to: "/admin/tender-names", label: "Tender Names" },
];

export function Sidebar() {
  const { isAdmin } = useAuth();
  const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <nav className="w-48 shrink-0 border-r p-4">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "block rounded px-2 py-1 text-sm",
                  isActive ? "bg-muted font-medium" : "hover:bg-muted/50",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
