import { Navigate } from 'react-router-dom';
import { useAuth, UserRoleType } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRoleType;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, userRole, userRoles, loading } = useAuth();

  // Wait for both loading to complete AND roles to be resolved
  // This prevents race conditions where loading is false but roles haven't been set yet
  const isResolvingRoles = loading || (user && userRoles.length === 0);

  if (isResolvingRoles) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireRole && !userRoles.includes(requireRole)) {
    // Redirect to appropriate dashboard based on current role
    if (userRole === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (userRole === 'org_admin') {
      return <Navigate to="/org-admin" replace />;
    } else if (userRole === 'instructor' || userRole === 'coach') {
      return <Navigate to="/teaching" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
