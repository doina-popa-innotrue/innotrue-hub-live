import { Badge } from "@/components/ui/badge";

interface AdminStatusBadgeProps {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

/**
 * Standardized status badge for admin tables.
 */
export function AdminStatusBadge({
  isActive,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: AdminStatusBadgeProps) {
  return isActive ? (
    <Badge className="text-xs">{activeLabel}</Badge>
  ) : (
    <Badge variant="outline" className="text-xs">
      {inactiveLabel}
    </Badge>
  );
}
