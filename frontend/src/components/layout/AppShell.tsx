import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Sidebar rail plus a scrolling content column.
 *
 * There is no desktop top bar: it only ever repeated the page title, which each
 * page already renders through <PageHeader>. Identity and sign-out live at the
 * foot of the rail.
 *
 * Below `lg` the rail slides off-canvas, so a slim bar carries the button that
 * opens it. That bar shows the wordmark rather than the page title — the title
 * is still the page's own job.
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Navigating with the rail open (or hitting Escape) should close it.
  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-display text-base font-bold tracking-tight text-ink">
            Tender<span className="text-primary">Flow</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
