import { useEffect, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogOut, ArrowRight } from "lucide-react";

interface ExpectedUserInfo {
  name: string | null;
  email: string | null;
}

/**
 * Guard component that checks if the current logged-in user matches the expected user
 * from email deep links. Shows a prompt to switch accounts if there's a mismatch.
 */
export function SessionMismatchGuard({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [isMismatch, setIsMismatch] = useState(false);
  const [expectedUserInfo, setExpectedUserInfo] = useState<ExpectedUserInfo | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const expectedUserId = searchParams.get("expected_user");
  const loginHint = searchParams.get("login_hint");

  useEffect(() => {
    async function checkSession() {
      // No expected_user param means this is a normal navigation, not from email
      if (!expectedUserId) {
        setIsLoading(false);
        return;
      }

      // If not logged in, let ProtectedRoute handle it (will redirect to login)
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if current user matches expected user
      if (user.id === expectedUserId) {
        // Match! Clear the params and continue
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("expected_user");
        newParams.delete("login_hint");
        const cleanPath = newParams.toString()
          ? `${location.pathname}?${newParams.toString()}`
          : location.pathname;
        navigate(cleanPath, { replace: true });
        setIsLoading(false);
        return;
      }

      // Mismatch - fetch info about both users
      setIsMismatch(true);

      // Get expected user's name
      const { data: expectedProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", expectedUserId)
        .single();

      setExpectedUserInfo({
        name: expectedProfile?.name || null,
        email: loginHint ? decodeURIComponent(loginHint) : null,
      });

      // Get current user's name
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      setCurrentUserName(currentProfile?.name || user.email || "Unknown");
      setIsLoading(false);
    }

    checkSession();
  }, [user, expectedUserId, loginHint, searchParams, location.pathname, navigate]);

  const handleSwitchAccount = async () => {
    // Sign out and redirect to auth with login hint
    await signOut();

    // Build redirect URL with the current path (so they return here after login)
    const currentPath = location.pathname;
    const authUrl = loginHint
      ? `/auth?redirect=${encodeURIComponent(currentPath)}&login_hint=${encodeURIComponent(loginHint)}`
      : `/auth?redirect=${encodeURIComponent(currentPath)}`;

    navigate(authUrl);
  };

  const handleContinueAnyway = () => {
    // Clear the expected_user params and continue with current session
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("expected_user");
    newParams.delete("login_hint");
    const cleanPath = newParams.toString()
      ? `${location.pathname}?${newParams.toString()}`
      : location.pathname;
    navigate(cleanPath, { replace: true });
    setIsMismatch(false);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (isMismatch && expectedUserInfo) {
    const expectedDisplay =
      expectedUserInfo.name || expectedUserInfo.email || "the intended recipient";

    return (
      <div className="container max-w-lg mx-auto py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
            <CardTitle>Different Account Signed In</CardTitle>
            <CardDescription className="text-base mt-2">
              This feedback was sent to <strong>{expectedDisplay}</strong>, but you're currently
              signed in as <strong>{currentUserName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSwitchAccount} className="w-full" size="lg">
              <LogOut className="h-4 w-4 mr-2" />
              Sign in as {expectedUserInfo.name || expectedUserInfo.email || "correct account"}
            </Button>

            <Button onClick={handleContinueAnyway} variant="outline" className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue as {currentUserName}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Continuing with the wrong account may prevent you from viewing your personal feedback.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
