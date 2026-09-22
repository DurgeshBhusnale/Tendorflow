import { createContext, useContext, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** Label for the action button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** `destructive` paints the action button red — use it for every delete. */
  tone?: "default" | "destructive";
  /**
   * Runs when the user confirms. The dialog stays open while it is pending and,
   * if it throws, shows the error inline instead of closing — so a call site
   * needs no try/catch and no second dialog to report a failure.
   */
  onConfirm: () => Promise<unknown> | unknown;
}

export const ConfirmContext = createContext<((options: ConfirmOptions) => void) | null>(null);

/**
 * Opens the app's confirmation dialog (CH-20). Replaces `window.confirm` and
 * `window.alert`, which render as browser chrome and cannot be styled.
 *
 *   const confirm = useConfirm();
 *   confirm({ title: "Delete this tender?", tone: "destructive", onConfirm: () => remove(id) });
 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>.");
  return confirm;
}
