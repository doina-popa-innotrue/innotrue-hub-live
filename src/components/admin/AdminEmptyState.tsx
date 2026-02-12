import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon, Plus } from "lucide-react";

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

/**
 * Standardized empty state for admin pages.
 *
 * @example
 * ```tsx
 * <AdminEmptyState
 *   icon={FolderTree}
 *   title="No assessment families yet"
 *   description="Create families to group related assessment versions together"
 *   actionLabel="Create Family"
 *   onAction={() => setIsDialogOpen(true)}
 * />
 * ```
 */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: AdminEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mb-4 max-w-md">{description}</p>

        {children}

        {actionLabel && onAction && !children && (
          <Button onClick={onAction}>
            <Plus className="h-4 w-4 mr-2" />
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
