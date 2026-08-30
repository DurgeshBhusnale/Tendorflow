import { createBrowserRouter } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Temporary placeholder — replaced by the real routes (LoginPage, ProtectedRoute,
// AdminRoute, etc.) in Phase 1.
function ScaffoldPlaceholder() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Tender App</h1>
      <p className="mt-2 text-muted-foreground">
        Phase 0 scaffold — routes land in Phase 1 (Auth).
      </p>
      <Button className="mt-4">Tailwind + shadcn/ui wired up</Button>
    </div>
  );
}

export const router = createBrowserRouter([{ path: "/", element: <ScaffoldPlaceholder /> }]);
