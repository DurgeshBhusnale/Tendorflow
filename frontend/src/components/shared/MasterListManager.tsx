import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/types/api";

/** The shape both admin-managed master lists (portals, tender names) share. */
export interface MasterListItem {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

const nameSchema = z.object({
  name: z.string().min(1, "Required").max(120),
});
type NameFormValues = z.infer<typeof nameSchema>;

interface MasterListManagerProps {
  title: string;
  /** Singular noun used in the add button and empty state, e.g. "Portal". */
  entityLabel: string;
  items: MasterListItem[];
  isLoading: boolean;
  onCreate: (name: string) => Promise<unknown>;
  onToggleActive: (item: MasterListItem) => Promise<unknown>;
}

export function MasterListManager({
  title,
  entityLabel,
  items,
  isLoading,
  onCreate,
  onToggleActive,
}: MasterListManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NameFormValues>({ resolver: zodResolver(nameSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onCreate(values.name);
      reset();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  const columns: Column<MasterListItem>[] = [
    { header: "Name", cell: (item) => item.name },
    {
      header: "Status",
      cell: (item) => (
        <span className={item.is_active ? "text-green-700" : "text-muted-foreground"}>
          {item.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    { header: "Date Added", cell: (item) => formatDate(item.created_at) },
    {
      header: "Actions",
      cell: (item) => (
        <Button variant="outline" size="sm" onClick={() => void onToggleActive(item)}>
          {item.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  const addButton = (
    <Button onClick={() => setShowForm(true)}>+ Add {entityLabel}</Button>
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        {!showForm && addButton}
      </div>

      <p className="text-sm text-muted-foreground">
        Inactive entries disappear from employee-facing dropdowns, but existing records that
        reference them are unaffected.
      </p>

      {showForm && (
        <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">{entityLabel} Name</label>
            <Input {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : `Add ${entityLabel}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setFormError(null);
                setShowForm(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        isLoading={isLoading}
        empty={
          <EmptyState title={`No ${entityLabel.toLowerCase()}s yet`} action={addButton} />
        }
      />
    </div>
  );
}
