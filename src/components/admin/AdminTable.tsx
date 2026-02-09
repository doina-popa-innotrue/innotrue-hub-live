import { ReactNode, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminLoadingState } from './AdminLoadingState';
import { AdminEmptyState } from './AdminEmptyState';
import { LucideIcon } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface AdminTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Accessor function or key path */
  accessor: keyof T | ((item: T) => ReactNode);
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom sort function */
  sortFn?: (a: T, b: T) => number;
  /** Column width class */
  className?: string;
  /** Hide on mobile */
  hideOnMobile?: boolean;
}

interface AdminTableProps<T extends { id: string }> {
  /** Table title */
  title?: string;
  /** Table description */
  description?: string;
  /** Data to display */
  data: T[] | undefined;
  /** Column definitions */
  columns: AdminTableColumn<T>[];
  /** Loading state */
  isLoading?: boolean;
  /** Empty state configuration */
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  /** Actions column renderer */
  renderActions?: (item: T) => ReactNode;
  /** Show actions column */
  showActions?: boolean;
  /** Actions column header */
  actionsHeader?: string;
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Custom row class name */
  rowClassName?: (item: T) => string;
  /** Hide card wrapper */
  hideCard?: boolean;
  /** Initial sort column key */
  initialSortKey?: string;
  /** Initial sort direction */
  initialSortDirection?: 'asc' | 'desc';
  /** Enable pagination */
  paginated?: boolean;
  /** Items per page (default: 10) */
  pageSize?: number;
  /** Page size options */
  pageSizeOptions?: number[];
}

type SortDirection = 'asc' | 'desc' | null;

/**
 * Standardized admin table with sorting, loading states, and empty state.
 * 
 * @example
 * ```tsx
 * <AdminTable
 *   title="Module Types"
 *   description="Manage module types"
 *   data={moduleTypes}
 *   isLoading={isLoading}
 *   columns={[
 *     { key: 'name', header: 'Name', accessor: 'name', sortable: true },
 *     { key: 'description', header: 'Description', accessor: 'description' },
 *   ]}
 *   renderActions={(item) => (
 *     <AdminTableActions onEdit={() => openEdit(item)} onDelete={() => handleDelete(item.id)} />
 *   )}
 *   emptyState={{
 *     icon: Blocks,
 *     title: 'No module types yet',
 *     description: 'Create your first module type.',
 *     actionLabel: 'New Module Type',
 *     onAction: openCreate,
 *   }}
 * />
 * ```
 */
export function AdminTable<T extends { id: string }>({
  title,
  description,
  data,
  columns,
  isLoading,
  emptyState,
  renderActions,
  showActions = true,
  actionsHeader = 'Actions',
  onRowClick,
  rowClassName,
  hideCard,
  initialSortKey,
  initialSortDirection = 'asc',
  paginated = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
}: AdminTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialSortKey ? initialSortDirection : null
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!data || !sortKey || !sortDirection) return data;

    const column = columns.find((c) => c.key === sortKey);
    if (!column) return data;

    return [...data].sort((a, b) => {
      // Use custom sort function if provided
      if (column.sortFn) {
        const result = column.sortFn(a, b);
        return sortDirection === 'asc' ? result : -result;
      }

      // Default sorting
      let aValue: unknown;
      let bValue: unknown;

      if (typeof column.accessor === 'function') {
        aValue = column.accessor(a);
        bValue = column.accessor(b);
      } else {
        aValue = a[column.accessor];
        bValue = b[column.accessor];
      }

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? result : -result;
      }

      // Number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Boolean comparison
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? -1 : 1)
          : (aValue === bValue ? 0 : aValue ? 1 : -1);
      }

      return 0;
    });
  }, [data, sortKey, sortDirection, columns]);

  // Pagination
  const {
    paginatedData,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    pageSize,
    setPageSize,
    startIndex,
    endIndex,
    getPageNumbers,
  } = usePagination(sortedData, { pageSize: initialPageSize });

  // Use paginated data if pagination is enabled, otherwise use sorted data
  const displayData = paginated ? paginatedData : sortedData;

  const getCellValue = (item: T, column: AdminTableColumn<T>): ReactNode => {
    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    const value = item[column.accessor];
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const paginationControls = paginated && totalPages > 1 && (
    <div className="flex items-center justify-between px-2 py-4 border-t">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex + 1, totalItems)} of {totalItems}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-[70px]" aria-label="Items per page">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>per page</span>
      </div>
      <nav className="flex items-center gap-1" role="navigation" aria-label="Pagination">
        <Button
          variant="outline"
          size="sm"
          onClick={previousPage}
          disabled={!hasPreviousPage}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </Button>
        <div className="flex items-center gap-1">
          {getPageNumbers(5).map((page, index) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => goToPage(page)}
                aria-label={`Go to page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
                className="min-w-[36px]"
              >
                {page}
              </Button>
            )
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={nextPage}
          disabled={!hasNextPage}
          aria-label="Go to next page"
        >
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );

  const tableContent = (
    <>
      {isLoading ? (
        <AdminLoadingState message="Loading data..." />
      ) : !sortedData || sortedData.length === 0 ? (
        emptyState ? (
          <AdminEmptyState
            icon={emptyState.icon}
            title={emptyState.title}
            description={emptyState.description}
            actionLabel={emptyState.actionLabel}
            onAction={emptyState.onAction}
          />
        ) : (
          <p className="text-center text-muted-foreground py-8">No data available</p>
        )
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={cn(
                          column.className,
                          column.hideOnMobile && 'hidden md:table-cell',
                          column.sortable && 'cursor-pointer select-none'
                        )}
                        onClick={column.sortable ? () => handleSort(column.key) : undefined}
                        aria-sort={
                          sortKey === column.key
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <div className="flex items-center">
                          {column.header}
                          {column.sortable && <SortIcon columnKey={column.key} />}
                        </div>
                      </TableHead>
                    ))}
                    {showActions && renderActions && (
                      <TableHead className="text-right">{actionsHeader}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData?.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        onRowClick && 'cursor-pointer',
                        rowClassName?.(item)
                      )}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(
                            column.className,
                            column.hideOnMobile && 'hidden md:table-cell'
                          )}
                        >
                          {getCellValue(item, column)}
                        </TableCell>
                      ))}
                      {showActions && renderActions && (
                        <TableCell className="text-right">
                          <div onClick={(e) => e.stopPropagation()}>
                            {renderActions(item)}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          {paginationControls}
        </>
      )}
    </>
  );

  if (hideCard) {
    return tableContent;
  }

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={!title && !description ? 'pt-6' : undefined}>
        {tableContent}
      </CardContent>
    </Card>
  );
}
