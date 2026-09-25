import { Pencil, Trash2 } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Where a row's actions are being rendered.
 *
 * `row` is the desktop table cell, where icon-only keeps an eleven-column table
 * on the screen. `sheet` is the phone's record sheet, where there is room for
 * words and the buttons are the only thing to aim at (CH-30).
 */
const ActionsPlacementContext = createContext<"row" | "sheet">("row");

export function SheetActions({ children }: { children: ReactNode }) {
  return (
    <ActionsPlacementContext.Provider value="sheet">{children}</ActionsPlacementContext.Provider>
  );
}

interface RowActionsProps {
  onEdit: () => void;
  /** Omit to render edit alone — deletion is admin-only across every module. */
  onDelete?: () => void;
  /** Module-specific actions rendered ahead of edit/delete. */
  children?: ReactNode;
}

/**
 * The edit/delete pair every table row ends with.
 *
 * Icon-only in a table cell so a nine-column table still fits a 1440px desktop;
 * the label stays available to screen readers and as a hover tooltip. Outlined
 * rather than ghost so they read as pressable without being hovered first.
 */
export function RowActions({ onEdit, onDelete, children }: RowActionsProps) {
  const placement = useContext(ActionsPlacementContext);
  const inSheet = placement === "sheet";

  return (
    <div className={inSheet ? "flex flex-1 items-center gap-2" : "flex items-center justify-end gap-1.5"}>
      {children}
      <Button
        variant="outline"
        size={inSheet ? "default" : "icon"}
        onClick={onEdit}
        aria-label="Edit"
        title="Edit"
        className={inSheet ? "flex-1" : "text-muted-foreground hover:text-foreground"}
      >
        <Pencil />
        {inSheet && "Edit"}
      </Button>
      {onDelete && (
        <Button
          variant="outline"
          size={inSheet ? "default" : "icon"}
          onClick={onDelete}
          aria-label="Delete"
          title="Delete"
          className="border-red-200 text-destructive hover:bg-red-50 hover:text-destructive"
        >
          <Trash2 />
          {inSheet && "Delete"}
        </Button>
      )}
    </div>
  );
}

/** Placeholder shown where the current user lacks permission to act. */
export function NoActions() {
  return <span className="block text-right text-muted-foreground">—</span>;
}
