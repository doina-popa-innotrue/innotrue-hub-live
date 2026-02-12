import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbProps {
  /** Breadcrumb items (excluding home) */
  items: BreadcrumbItem[];
  /** Show home icon link */
  showHome?: boolean;
  /** Home link path */
  homePath?: string;
}

/**
 * Standardized breadcrumb navigation for admin pages.
 *
 * @example
 * ```tsx
 * <AdminBreadcrumb
 *   items={[
 *     { label: 'Programs', href: '/admin/programs' },
 *     { label: 'Edit Program' },
 *   ]}
 * />
 * ```
 */
export function AdminBreadcrumb({
  items,
  showHome = true,
  homePath = "/admin",
}: AdminBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {showHome && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={homePath} className="flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Admin Home</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={index}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Auto-generates breadcrumb items from current path.
 * Useful for simple cases where URL structure matches navigation.
 */
export function useAutoBreadcrumb(
  labelMap?: Record<string, string>,
  basePath = "/admin",
): BreadcrumbItem[] {
  const location = useLocation();
  const pathSegments = location.pathname.replace(basePath, "").split("/").filter(Boolean);

  return pathSegments.map((segment, index) => {
    const href = `${basePath}/${pathSegments.slice(0, index + 1).join("/")}`;
    const isLast = index === pathSegments.length - 1;

    // Try to get label from map, otherwise format the segment
    const label = labelMap?.[segment] ?? formatSegmentLabel(segment);

    return {
      label,
      href: isLast ? undefined : href,
    };
  });
}

function formatSegmentLabel(segment: string): string {
  // Handle UUIDs - return "Detail" for likely IDs
  if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return "Detail";
  }

  // Convert kebab-case to Title Case
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
