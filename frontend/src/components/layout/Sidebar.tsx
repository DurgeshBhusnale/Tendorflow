import { LogOut } from "lucide-react";
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

/**
 * The navigation rail — the one dark surface in the app, and desktop only.
 *
 * Navy rather than white so the content column reads as the workspace and the
 * rail as its frame. The active route is marked by a filled rounded item, which
 * replaced the 2px edge indicator of the first prototype: a fill survives being
 * glanced at, a hairline on the far edge of a 240px rail does not.
 *
 * Below `lg` it is not rendered at all: phones navigate with `<TabBar>` and the
 * More screen, which carry the same groups from `lib/nav.ts` (CH-30).
 */
export function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const confirm = useConfirm();

  // Signing out is one click next to the nav, and coming back means finding
  // the password again — cheap to confirm, annoying to do by accident.
  function handleLogout() {
    confirm({
      title: "Are you sure you want to sign out?",
      description: "You will need your username and password to get back in.",
      confirmLabel: "Sign out",
      onConfirm: () => logout(),
    });
  }
  const groups = navGroups.filter((group) => !group.adminOnly || isAdmin);

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {/* The logo artwork has a white ground, so it sits on a white plate
            rather than floating as a box against the navy rail. */}
        <div className="flex h-[76px] shrink-0 items-center border-b border-sidebar-border px-4">
          <div className="flex h-12 w-full items-center justify-center rounded-lg bg-white px-3">
            <img src="/logo.png" alt="Mangal Infotech" className="max-h-10 w-auto object-contain" />
          </div>
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
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
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
  );
}
