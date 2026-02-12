import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AdminFormActionsProps {
  isEditing: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  submitLabel?: { create: string; update: string };
}

/**
 * Standardized form action buttons for admin dialogs.
 *
 * @example
 * ```tsx
 * <AdminFormActions
 *   isEditing={!!editingItem}
 *   isSubmitting={isMutating}
 *   onCancel={() => setIsDialogOpen(false)}
 * />
 * ```
 */
export function AdminFormActions({
  isEditing,
  isSubmitting,
  onCancel,
  submitLabel = { create: "Create", update: "Update" },
}: AdminFormActionsProps) {
  return (
    <div className="flex gap-2 justify-end">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {isEditing ? submitLabel.update : submitLabel.create}
      </Button>
    </div>
  );
}
