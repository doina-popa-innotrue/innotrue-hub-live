import { Button } from '@/components/ui/button';
import { Edit, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReactNode } from 'react';

interface AdminTableActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  /** Additional actions for dropdown */
  additionalActions?: ReactNode;
  /** Use dropdown menu instead of inline buttons */
  useDropdown?: boolean;
}

/**
 * Standardized table action buttons for admin pages.
 * 
 * @example
 * ```tsx
 * <AdminTableActions
 *   onEdit={() => handleEdit(item)}
 *   onDelete={() => handleDelete(item.id)}
 *   deleteDisabled={count > 0}
 *   deleteDisabledReason={`Has ${count} linked items`}
 * />
 * ```
 */
export function AdminTableActions({
  onEdit,
  onDelete,
  deleteDisabled,
  deleteDisabledReason,
  additionalActions,
  useDropdown = false,
}: AdminTableActionsProps) {
  if (useDropdown) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {additionalActions}
          {onDelete && (
            <DropdownMenuItem
              onClick={onDelete}
              disabled={deleteDisabled}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      {onEdit && (
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
          <Edit className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleteDisabled}
          title={deleteDisabled ? deleteDisabledReason : 'Delete'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
