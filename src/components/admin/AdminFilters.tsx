import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface AdminFiltersProps {
  /** Search value */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Filter definitions */
  filters?: Array<{
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    /** Include "All" option */
    includeAll?: boolean;
    allLabel?: string;
  }>;
  /** Additional content to render */
  children?: ReactNode;
  /** Additional className */
  className?: string;
  /** Show clear all button */
  showClearAll?: boolean;
  /** Clear all handler */
  onClearAll?: () => void;
}

/**
 * Standardized filter bar for admin pages with search and dropdown filters.
 *
 * @example
 * ```tsx
 * <AdminFilters
 *   searchValue={searchTerm}
 *   onSearchChange={setSearchTerm}
 *   searchPlaceholder="Search assessments..."
 *   filters={[
 *     {
 *       key: 'category',
 *       label: 'Category',
 *       value: categoryFilter,
 *       onChange: setCategoryFilter,
 *       options: categories.map(c => ({ value: c.id, label: c.name })),
 *       includeAll: true,
 *     },
 *     {
 *       key: 'status',
 *       label: 'Status',
 *       value: statusFilter,
 *       onChange: setStatusFilter,
 *       options: [
 *         { value: 'active', label: 'Active' },
 *         { value: 'inactive', label: 'Inactive' },
 *       ],
 *       includeAll: true,
 *     },
 *   ]}
 * />
 * ```
 */
export function AdminFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  children,
  className,
  showClearAll,
  onClearAll,
}: AdminFiltersProps) {
  const hasActiveFilters =
    (searchValue && searchValue.length > 0) ||
    filters.some((f) => f.value !== "all" && f.value !== "");

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center",
        className,
      )}
    >
      {onSearchChange && (
        <div className="relative w-full sm:w-auto sm:min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchValue && searchValue.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {filters.map((filter) => (
        <Select key={filter.key} value={filter.value} onValueChange={filter.onChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            {filter.includeAll && (
              <SelectItem value="all">{filter.allLabel || `All ${filter.label}`}</SelectItem>
            )}
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {children}

      {showClearAll && hasActiveFilters && onClearAll && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

/**
 * Hook to manage filter state for admin pages.
 *
 * @example
 * ```tsx
 * const { searchTerm, setSearchTerm, filters, setFilter, clearAll } = useAdminFilters({
 *   search: '',
 *   category: 'all',
 *   status: 'all',
 * });
 * ```
 */
export function useAdminFilters<T extends Record<string, string>>(initialFilters: T) {
  const [filters, setFilters] = useState<T>(initialFilters);

  const setFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setFilters(initialFilters);
  };

  return {
    filters,
    setFilter,
    clearAll,
    setFilters,
  };
}

// Need to import useState for the hook
import { useState } from "react";
