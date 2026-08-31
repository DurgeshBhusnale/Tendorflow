import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Module-specific actions rendered ahead of edit/delete (e.g. "Mark Paid"). */
  children?: ReactNode;
}

/**
 * The edit/delete pair every table row ends with.
 *
 * Icon-only so a nine-column table still fits a 1440px desktop; the label
 * stays available to screen readers and as a hover tooltip. Outlined rather
 * than ghost so they read as pressable without being hovered first.
 */
export function RowActions({ onEdit, onDelete, children }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {children}
      <Button variant="outline" size="icon" onClick={onEdit} aria-label="Edit" title="Edit">
        <Pencil />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onDelete}
        aria-label="Delete"
        title="Delete"
        className="hover:bg-red-50 hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/** Placeholder shown where the current user lacks permission to act. */
export function NoActions() {
  return <span className="block text-right text-muted-foreground">—</span>;
}
