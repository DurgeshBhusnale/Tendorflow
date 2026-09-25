import { ChevronRight, LogOut } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
import { navGroups, primaryTabs } from "@/lib/nav";

/**
 * Whether the rail is on screen, live — a CSS `hidden` would not do here,
 * because the redirect below has to actually not happen on a phone.
 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

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
 * The phone's fourth tab: everything the tab bar can't hold (CH-30).
 *
 * It lists the nav groups from `lib/nav.ts` minus the destinations that already
 * have a tab, so a page added to the rail appears here without being wired up
 * twice. Identity and sign-out live here too — on desktop they sit at the foot
 * of the rail, which phones no longer have.
 *
 * There is no desktop version: at `lg` the rail carries all of this, so the
 * route redirects rather than rendering a second navigation.
 */
export default function MorePage() {
  const { user, logout, isAdmin } = useAuth();
  const confirm = useConfirm();
  const isDesktop = useIsDesktop();

  const tabPaths = new Set(primaryTabs.map((tab) => tab.to));
  const groups = navGroups
    .filter((group) => !group.adminOnly || isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !tabPaths.has(item.to)),
    }))
    .filter((group) => group.items.length > 0);

  function handleLogout() {
    confirm({
      title: "Are you sure you want to sign out?",
      description: "You will need your username and password to get back in.",
      confirmLabel: "Sign out",
      onConfirm: () => logout(),
    });
  }

  // Desktop has the rail; this screen would be a second navigation.
  if (isDesktop) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <div className="page space-y-5">
        <h1 className="text-2xl">More</h1>

        <div className="flex items-center gap-3 rounded-2xl bg-ink p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {initials(user?.full_name)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-[15px] font-bold text-white">{user?.full_name}</p>
            <span className="inline-flex h-5 items-center rounded-full bg-white/10 px-2 text-[11px] font-semibold capitalize text-[hsl(var(--primary-light))]">
              {user?.role}
            </span>
          </div>
        </div>

        {groups.map((group) => (
          <section key={group.label ?? "primary"} className="space-y-2">
            <p className="eyebrow px-0.5 tracking-[0.1em] text-muted-foreground/70">
              {group.label}
            </p>
            <div className="surface divide-y divide-divider overflow-hidden">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 px-3.5 py-3.5 transition-colors active:bg-accent"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="size-[18px]" />
                  </span>
                  <span className="flex-1 text-[15px] font-semibold text-foreground">
                    {item.label}
                  </span>
                  <ChevronRight className="size-[18px] shrink-0 text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-[15px] font-semibold text-destructive"
        >
          <LogOut className="size-[18px]" />
          Sign out
        </button>
      </div>
    </>
  );
}
