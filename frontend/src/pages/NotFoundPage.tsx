import { FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * Catch-all for a URL that matches no route.
 *
 * Reachable only because the host rewrites every path to index.html so reloads
 * work (see vercel.json); without this the router would fall back to its own
 * unstyled error screen, which talks about the router rather than the app.
 */
export default function NotFoundPage() {
  return (
    <div className="page">
      <div className="surface">
        <EmptyState
          icon={FileQuestion}
          title="Page not found"
          description="That address doesn't match anything in the workspace. It may have been mistyped, or the page may have moved."
          action={
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
