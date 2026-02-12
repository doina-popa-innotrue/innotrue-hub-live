// Admin CRUD Infrastructure - Re-export all components
export { AdminPageHeader } from "./AdminPageHeader";
export { AdminEmptyState } from "./AdminEmptyState";
export { AdminLoadingState } from "./AdminLoadingState";
export { AdminFormActions } from "./AdminFormActions";
export { AdminStatusBadge } from "./AdminStatusBadge";
export { AdminTableActions } from "./AdminTableActions";
export { AdminTable } from "./AdminTable";
export { AdminFilters, useAdminFilters } from "./AdminFilters";
export { AdminBreadcrumb, useAutoBreadcrumb } from "./AdminBreadcrumb";

// Specialized admin components
export { InstructorCalcomEventTypes } from "./InstructorCalcomEventTypes";
export { EnrollmentModuleStaffManager } from "./EnrollmentModuleStaffManager";
export { ModuleScenariosEditor } from "./ModuleScenariosEditor";

// Re-export types
export type { AdminTableColumn } from "./AdminTable";
