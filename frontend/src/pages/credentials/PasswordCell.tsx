import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRevealPassword } from "@/hooks/useCredentials";
import type { Credential } from "@/types/credential";

/**
 * Click-to-reveal for one row.
 *
 * The list endpoint always returns a masked password, so revealing fetches
 * that single credential with `?reveal=true`. The revealed value lives only in
 * this component's state and is dropped when the user hides it again.
 */
export function PasswordCell({ credential }: { credential: Credential }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const revealPassword = useRevealPassword();

  async function handleReveal() {
    const fresh = await revealPassword.mutateAsync(credential.id);
    setRevealed(fresh.password);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="bg-muted px-2 py-1 font-mono text-xs tracking-tight text-foreground">
        {revealed ?? credential.password}
      </span>
      {revealed === null ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleReveal()}
          disabled={revealPassword.isPending}
        >
          <Eye />
          {revealPassword.isPending ? "…" : "Reveal"}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setRevealed(null)}>
          <EyeOff />
          Hide
        </Button>
      )}
    </div>
  );
}
