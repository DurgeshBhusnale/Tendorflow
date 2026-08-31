import { LogOut, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { navGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Two initials from a full name, e.g. "Priya Nair" → "PN". */
function initials(fullName: string | undefined): string {
  if (!fullName) return "—";
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface SidebarProps {
  /** Mobile only — on `lg` and up the rail is always in the layout. */
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();
  const groups = navGroups.filter((group) => !group.adminOnly || isAdmin);

  return (
    <>
      {/* Scrim, mobile only. */}
      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-ink/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-sidebar",
          // Off-canvas below lg, part of the flex row from lg up.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
          "lg:static lg:translate-x-0 lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border pl-6 pr-3">
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            Tender<span className="text-primary">Flow</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6">
          {groups.map((group) => (
            <div key={group.label ?? "primary"} className="mb-6 last:mb-0">
              {group.label && <p className="eyebrow px-6 pb-2">{group.label}</p>}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "relative flex items-center gap-3 px-6 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent font-semibold text-foreground"
                            : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-foreground" : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                          {/* 2px indicator on the right edge marks the active route. */}
                          {isActive && (
                            <span aria-hidden className="absolute inset-y-0 right-0 w-0.5 bg-ink" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Signed-in identity and sign-out live at the foot of the rail. */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center bg-ink text-xs font-semibold text-white">
              {initials(user?.full_name)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-foreground">{user?.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{user?.role}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => void logout()}>
            <LogOut />
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}
