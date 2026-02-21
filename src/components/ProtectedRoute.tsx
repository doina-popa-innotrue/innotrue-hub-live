import { Navigate } from "react-router-dom";
import { useAuth, UserRoleType } from "@/contexts/AuthContext";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRoleType;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, userRole, userRoles, registrationStatus, loading, authError, signOut } = useAuth();

  // Wait for both loading to complete AND roles to be resolved
  // Skip waiting if there's an auth error — show the error instead of loading forever
  // Also skip waiting if we know the registration status (user may legitimately have 0 roles)
  // For Google OAuth new users: the handle_new_user trigger creates a profile with
  // registration_status = 'complete' (column default), but no user_roles rows exist.
  // Detect this via provider + zero roles — regardless of registrationStatus value.
  const isOAuthNewUser = user && userRoles.length === 0 && user.app_metadata?.provider === "google";
  const isResolvingRoles = loading || (user && !authError && userRoles.length === 0 && !registrationStatus && !isOAuthNewUser);

  if (isResolvingRoles) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Auth error state — role fetch failed, timed out, or other auth issue
  if (user && authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Unable to Load Your Account</CardTitle>
            <CardDescription className="text-sm">{authError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={signOut} variant="ghost" className="w-full">
              Sign Out
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              If this problem persists, please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User needs to complete registration (choose their role)
  if (user && registrationStatus === "pending_role_selection") {
    return <Navigate to="/complete-registration" replace />;
  }

  // Google OAuth new user — no profile, no roles. Redirect to complete registration.
  if (isOAuthNewUser) {
    return <Navigate to="/complete-registration" replace />;
  }

  // User authenticated but has no roles (successful fetch, genuinely zero roles)
  if (user && userRoles.length === 0) {
    // Coach/instructor application under review — but they have client role,
    // so this branch shouldn't normally trigger for pending_approval users.
    // Safety net for edge cases.
    if (registrationStatus === "pending_approval") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <Card className="max-w-md w-full mx-4">
            <CardHeader className="text-center">
              <CardTitle>Application Under Review</CardTitle>
              <CardDescription>
                Your coach/instructor application is being reviewed by our team. You'll be notified once a decision is made.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={signOut} variant="outline" className="w-full">
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle>Account Not Configured</CardTitle>
            <CardDescription>
              Your account does not have any assigned roles. Please contact your administrator to
              get access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={signOut} variant="outline" className="w-full">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireRole && !userRoles.includes(requireRole)) {
    // Redirect to appropriate dashboard based on current role
    if (userRole === "admin") {
      return <Navigate to="/admin" replace />;
    } else if (userRole === "org_admin") {
      return <Navigate to="/org-admin" replace />;
    } else if (userRole === "instructor" || userRole === "coach") {
      return <Navigate to="/teaching" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
