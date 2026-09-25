import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";

/**
 * Navigation plus a scrolling content column.
 *
 * Desktop is the navy rail beside the content; there is no top bar, because it
 * only ever repeated the page title each page already renders.
 *
 * Below `lg` the rail is not there at all (CH-30). A phone gets a bottom tab
 * bar instead of an off-canvas copy of the desktop navigation: the four
 * destinations sit in the thumb zone, and `<PageHeader>` becomes the app bar.
 * The content column keeps enough bottom padding to clear the tab bar.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom,0px))] lg:pb-0">
          <Outlet />
        </main>
      </div>

      <TabBar />
    </div>
  );
}
