import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { user, userRole, userRoles, registrationStatus, loading } = useAuth();
  const navigate = useNavigate();
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Wait until loading is complete AND we have either no user or a determined role
    if (loading) return;

    if (!user) {
      navigate("/auth", { replace: true });
    } else if (registrationStatus === "pending_role_selection") {
      navigate("/complete-registration", { replace: true });
    } else if (
      // Google OAuth new user — zero roles + Google provider. The handle_new_user trigger
      // already created a profile with registration_status='complete', so we can't check
      // !registrationStatus. Zero roles + Google provider is the reliable indicator.
      userRoles.length === 0 &&
      user.app_metadata?.provider === "google"
    ) {
      navigate("/complete-registration", { replace: true });
    } else if (userRole) {
      if (userRole === "admin") {
        navigate("/admin", { replace: true });
      } else if (userRole === "instructor" || userRole === "coach") {
        navigate("/teaching", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
    // If user exists but userRole is null, wait for roles to load
  }, [user, userRole, userRoles, registrationStatus, loading, navigate]);

  useEffect(() => {
    // Safety fallback: if user is authenticated but role resolution never completes,
    // don't leave them stuck on the setup screen.
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (!loading && user && !userRole) {
      fallbackTimerRef.current = setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 6000);
    }

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [loading, user, userRole, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 w-64">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="text-sm text-muted-foreground mt-4">
          Please wait while we set up your dashboard
        </div>
      </div>
    </div>
  );
};

export default Index;
