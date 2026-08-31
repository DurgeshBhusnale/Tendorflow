import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Sidebar rail plus a scrolling content column.
 *
 * There is no top bar: it only ever repeated the page title, which each page
 * already renders through <PageHeader>. Identity and sign-out moved to the
 * foot of the sidebar.
 */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
