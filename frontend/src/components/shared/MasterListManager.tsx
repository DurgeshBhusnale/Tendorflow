import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Tags } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Drawer, DrawerBody, DrawerFooter } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
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

  function closeForm() {
    reset();
    setFormError(null);
    setShowForm(false);
  }

  const columns: Column<MasterListItem>[] = [
    {
      header: "Name",
      mobile: "title",
      cell: (item) => <span className="font-medium text-foreground">{item.name}</span>,
    },
    {
      header: "Status",
      cell: (item) => (
        <StatusPill
          label={item.is_active ? "Active" : "Inactive"}
          tone={item.is_active ? "green" : "slate"}
        />
      ),
    },
    {
      header: "Date Added",
      cell: (item) => <span className="text-muted-foreground">{formatDate(item.created_at)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      mobile: "actions",
      cell: (item) => (
        <Button variant="outline" size="sm" onClick={() => void onToggleActive(item)}>
          {item.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  const addButton = (
    <Button onClick={() => setShowForm(true)}>
      <Plus />
      Add {entityLabel}
    </Button>
  );

  return (
    <div className="page">
      <PageHeader
        title={title}
        description="Inactive entries disappear from employee-facing dropdowns, but existing records that reference them are unaffected."
        actions={addButton}
      />

      <div className="surface">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(item) => item.id}
          isLoading={isLoading}
          empty={
            <EmptyState
              icon={Tags}
              title={`No ${entityLabel.toLowerCase()}s yet`}
              description={`Add a ${entityLabel.toLowerCase()} to make it selectable across the app.`}
              action={addButton}
            />
          }
        />
      </div>

      <Drawer
        open={showForm}
        onClose={closeForm}
        title={`Add ${entityLabel}`}
        description={`New entries are active immediately and appear in every ${entityLabel.toLowerCase()} dropdown.`}
      >
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <DrawerBody>
            <div className="space-y-1.5">
              <Label htmlFor="master_list_name">{entityLabel} Name</Label>
              <Input id="master_list_name" {...register("name")} />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            {formError && (
              <p className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : `Add ${entityLabel}`}
            </Button>
          </DrawerFooter>
        </form>
      </Drawer>
    </div>
  );
}
