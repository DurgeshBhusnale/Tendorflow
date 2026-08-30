import { useAuth } from "@/auth/AuthContext";

// Temporary placeholder — replaced by the real metrics dashboard in Phase 7.
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {user?.full_name} ({user?.role}). Real metrics land in a later phase.
      </p>
    </div>
  );
}
