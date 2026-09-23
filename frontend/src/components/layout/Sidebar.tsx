import { FileText, LogOut, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
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

/**
 * The navigation rail — the one dark surface in the app.
 *
 * Navy rather than white so the content column reads as the workspace and the
 * rail as its frame. The active route is marked by a filled rounded item, which
 * replaced the 2px edge indicator of the first prototype: a fill survives being
 * glanced at, a hairline on the far edge of a 240px rail does not.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout, isAdmin } = useAuth();
  const confirm = useConfirm();

  // Signing out is one click next to the nav, and coming back means finding
  // the password again — cheap to confirm, annoying to do by accident.
  function handleLogout() {
    confirm({
      title: "Sign out?",
      description: "You will need your username and password to get back in.",
      confirmLabel: "Sign out",
      onConfirm: () => logout(),
    });
  }
  const groups = navGroups.filter((group) => !group.adminOnly || isAdmin);

  return (
    <>
      {/* Scrim, mobile only. */}
      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-ink/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "flex h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground",
          // Off-canvas below lg, part of the flex row from lg up.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
          "lg:static lg:translate-x-0 lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_4px_12px_rgb(41_82_227/0.45)]">
            <FileText className="size-[18px]" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-white">
            Tender<span className="text-[hsl(var(--primary-light))]">Flow</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-2 ml-auto rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6">
          {groups.map((group) => (
            <div key={group.label ?? "primary"} className="mb-7 last:mb-0">
              {group.label && (
                <p className="eyebrow px-3 pb-2.5 tracking-[0.1em] text-sidebar-muted">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-active font-semibold text-white"
                            : "font-medium text-sidebar-foreground hover:bg-white/5 hover:text-white",
                        )
                      }
                    >
                      <item.icon className="size-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Signed-in identity and sign-out live at the foot of the rail. */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {initials(user?.full_name)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
              <p className="text-xs capitalize text-sidebar-muted">{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
