import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Right-side slide-over used for every data-entry form in the app.
 *
 * Renders nothing when closed, so the form inside mounts fresh each time it
 * opens — that is what lets React Hook Form pick up new `defaultValues` when
 * the user switches from "add" to editing a specific row.
 *
 * The panel is a flex column with a fixed header; children are expected to be
 * a `flex h-full flex-col` form so their action bar pins to the bottom.
 */
export function Drawer({ open, onClose, title, description, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    // Lock background scrolling while the slide-over owns the screen.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink/45" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full animate-slide-in-right flex-col bg-card shadow-drawer sm:w-[500px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl">{title}</h2>
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-hidden">{children}</div>
      </aside>
    </div>
  );
}

/** Scrollable field area of a drawer form. */
export function DrawerBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-6">{children}</div>;
}

/**
 * Groups the fields that belong to one idea — the client, the money, the key's
 * current holder — under a small caps heading, so a long form reads as three
 * short sections rather than one column of twelve inputs.
 */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-border pb-5 last:border-b-0 last:pb-0">
      <p className="eyebrow tracking-[0.1em] text-muted-foreground/70">{title}</p>
      {children}
    </section>
  );
}

/** Pinned action bar at the foot of a drawer form. */
export function DrawerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-4 sm:px-6">
      {children}
    </div>
  );
}
