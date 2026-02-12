import { useState, useMemo, useCallback } from "react";

interface UsePaginationOptions {
  /** Items per page (default: 10) */
  pageSize?: number;
  /** Initial page (default: 1) */
  initialPage?: number;
}

interface UsePaginationResult<T> {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Items for the current page */
  paginatedData: T[];
  /** Go to a specific page */
  goToPage: (page: number) => void;
  /** Go to the next page */
  nextPage: () => void;
  /** Go to the previous page */
  previousPage: () => void;
  /** Go to the first page */
  firstPage: () => void;
  /** Go to the last page */
  lastPage: () => void;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Current page size */
  pageSize: number;
  /** Change page size */
  setPageSize: (size: number) => void;
  /** Start index of current page (0-indexed) */
  startIndex: number;
  /** End index of current page (0-indexed) */
  endIndex: number;
  /** Get page numbers to display */
  getPageNumbers: (maxVisible?: number) => (number | "ellipsis")[];
}

/**
 * Generic pagination hook for client-side pagination.
 *
 * @example
 * ```tsx
 * const { paginatedData, currentPage, totalPages, goToPage, hasNextPage, hasPreviousPage } = usePagination(data, { pageSize: 20 });
 * ```
 */
export function usePagination<T>(
  data: T[] | undefined,
  options: UsePaginationOptions = {},
): UsePaginationResult<T> {
  const { pageSize: initialPageSize = 10, initialPage = 1 } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp current page to valid range when data or pageSize changes
  const validCurrentPage = useMemo(() => {
    return Math.min(Math.max(1, currentPage), totalPages);
  }, [currentPage, totalPages]);

  // Reset to page 1 if current page is out of bounds
  useMemo(() => {
    if (currentPage !== validCurrentPage) {
      setCurrentPage(validCurrentPage);
    }
  }, [currentPage, validCurrentPage]);

  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, startIndex, pageSize]);

  const hasNextPage = validCurrentPage < totalPages;
  const hasPreviousPage = validCurrentPage > 1;

  const goToPage = useCallback(
    (page: number) => {
      const targetPage = Math.min(Math.max(1, page), totalPages);
      setCurrentPage(targetPage);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [hasPreviousPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  }, []);

  const getPageNumbers = useCallback(
    (maxVisible: number = 5): (number | "ellipsis")[] => {
      if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const pages: (number | "ellipsis")[] = [];
      const sidePages = Math.floor((maxVisible - 3) / 2);

      // Always show first page
      pages.push(1);

      if (validCurrentPage <= sidePages + 2) {
        // Near the start
        for (let i = 2; i <= Math.min(maxVisible - 1, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > maxVisible) {
          pages.push("ellipsis");
        }
      } else if (validCurrentPage >= totalPages - sidePages - 1) {
        // Near the end
        if (totalPages > maxVisible) {
          pages.push("ellipsis");
        }
        for (let i = Math.max(2, totalPages - maxVisible + 2); i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push("ellipsis");
        for (let i = validCurrentPage - sidePages; i <= validCurrentPage + sidePages; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }

      return pages;
    },
    [totalPages, validCurrentPage],
  );

  return {
    currentPage: validCurrentPage,
    totalPages,
    totalItems,
    paginatedData,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    hasNextPage,
    hasPreviousPage,
    pageSize,
    setPageSize: handleSetPageSize,
    startIndex,
    endIndex,
    getPageNumbers,
  };
}
