import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfirmContext, type ConfirmOptions } from "@/hooks/useConfirm";
import { ApiError } from "@/types/api";

/**
 * Hosts the single confirmation dialog the whole app shares (CH-20). Mounted
 * once in App.tsx; pages open it through `useConfirm()`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  return (
    <ConfirmContext.Provider value={setOptions}>
      {children}
      {/* Keyed so each request starts with fresh pending/error state. */}
      {options && (
        <ConfirmDialog key={options.title} options={options} onClose={() => setOptions(null)} />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  const { title, description, confirmLabel = "Confirm", tone = "default", onConfirm } = options;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Closing mid-request would hide the outcome, so dismissal waits it out.
  const dismiss = useCallback(() => {
    if (!pending) onClose();
  }, [pending, onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dismiss]);

  async function run() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  // Portalled for the same reason as the drawer: a fixed overlay must be
  // measured against the viewport, not whatever wrapper it was rendered in.
  return createPortal(
    // Above the drawer (z-50), so a confirmation raised from inside one still shows.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/45" onClick={dismiss} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md animate-fade-in rounded-xl border border-border bg-card shadow-pop"
      >
        <div className="px-5 py-5 sm:px-6">
          <h2 id={titleId} className="text-xl">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-2 space-y-2 text-sm text-muted-foreground">
              {description}
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">
          {/* Focus lands on Cancel: Enter on a freshly opened dialog must not delete anything. */}
          <Button type="button" variant="outline" onClick={dismiss} disabled={pending} autoFocus>
            Cancel
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={run}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
