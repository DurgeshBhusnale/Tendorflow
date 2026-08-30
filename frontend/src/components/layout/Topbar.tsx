import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b p-4">
      <span className="text-sm text-muted-foreground">
        {user?.full_name} ({user?.role})
      </span>
      <Button variant="outline" size="sm" onClick={() => void logout()}>
        Log out
      </Button>
    </header>
  );
}
