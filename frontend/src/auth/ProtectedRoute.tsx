import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    // Carry where they were headed, so signing in returns them there rather
    // than to the dashboard. This matters most on a reload or a pasted link:
    // the session may be stale, and losing the page is the second annoyance
    // after being asked to sign in.
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
