import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  
  // Dialog props (optional - if not provided, just renders the header)
  isDialogOpen?: boolean;
  onDialogOpenChange?: (open: boolean) => void;
  dialogTitle?: string;
  dialogContent?: ReactNode;
  
  // Create button props
  createButtonLabel?: string;
  showCreateButton?: boolean;
  
  // Custom actions
  actions?: ReactNode;
}

/**
 * Standardized admin page header with optional create dialog.
 * 
 * @example
 * ```tsx
 * <AdminPageHeader
 *   title="Assessment Families"
 *   description="Group related assessment versions together"
 *   isDialogOpen={isDialogOpen}
 *   onDialogOpenChange={setIsDialogOpen}
 *   dialogTitle={editingItem ? "Edit Family" : "Create Family"}
 *   dialogContent={<MyForm />}
 *   createButtonLabel="New Family"
 * />
 * ```
 */
export function AdminPageHeader({
  title,
  description,
  isDialogOpen,
  onDialogOpenChange,
  dialogTitle,
  dialogContent,
  createButtonLabel = 'Create New',
  showCreateButton = true,
  actions,
}: AdminPageHeaderProps) {
  const hasDialog = isDialogOpen !== undefined && onDialogOpenChange && dialogContent;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>
      
      <div className="flex gap-2 shrink-0">
        {actions}
        
        {hasDialog && showCreateButton && (
          <Dialog open={isDialogOpen} onOpenChange={onDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {createButtonLabel}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
              </DialogHeader>
              {dialogContent}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
