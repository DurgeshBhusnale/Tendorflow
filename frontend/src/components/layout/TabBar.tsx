import { NavLink } from "react-router-dom";
import { primaryTabs } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar — mobile navigation, below `lg` only (CH-30).
 *
 * The rail's hamburger is gone on phones: it hid the whole product behind one
 * tap. Four destinations sit in the thumb zone instead, and everything the bar
 * can't hold lives behind More, which is also where the identity and sign-out
 * that used to sit at the foot of the rail now live.
 *
 * Tabs come from `lib/nav.ts`, the same file the desktop rail reads, so the two
 * navigations can't drift apart.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card px-2 pb-[max(env(safe-area-inset-bottom,0px),10px)] pt-2 lg:hidden"
    >
      {primaryTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-[11px] transition-colors",
              isActive ? "font-semibold text-primary" : "font-medium text-muted-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                  isActive && "bg-primary/10",
                )}
              >
                <tab.icon className={cn("size-5", isActive && "stroke-[2.2]")} />
              </span>
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
