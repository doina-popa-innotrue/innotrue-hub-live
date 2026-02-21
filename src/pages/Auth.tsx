import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthContext } from "@/hooks/useAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { loginSchema, signupSchema } from "@/lib/validations";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Target,
  Users,
  TrendingUp,
  Sparkles,
  LucideIcon,
  KeyRound,
  Mail,
} from "lucide-react";
import { usePageView } from "@/hooks/useAnalytics";
import { PageLoadingState } from "@/components/ui/page-loading-state";

// Icon mapping for dynamic features
const iconMap: Record<string, LucideIcon> = {
  Target,
  Users,
  TrendingUp,
  Sparkles,
};

// Password reset validation schema
const passwordResetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function Auth() {
  const [searchParams] = useSearchParams();

  // Track page view for analytics
  usePageView("Auth");

  // Context params
  const contextSlug = searchParams.get("ref") || searchParams.get("context") || null;
  const orgSlug = searchParams.get("org") || null;
  const trackParam = searchParams.get("track") || null;

  // Password reset mode detection
  const resetMode = searchParams.get("mode") === "reset";

  // Deep link params (from email notifications)
  const loginHintParam = searchParams.get("login_hint") || "";
  const redirectParam = searchParams.get("redirect") || "";

  // Legacy params (still supported)
  const prefilledEmail = searchParams.get("email") || "";
  const prefilledName = searchParams.get("name") || "";
  const wheelCompleted = searchParams.get("wheel_completed") === "true";
  const planInterest = searchParams.get("plan_interest") || "";

  // UTM params for tracking
  const utmSource = searchParams.get("utm_source") || null;
  const utmMedium = searchParams.get("utm_medium") || null;
  const utmCampaign = searchParams.get("utm_campaign") || null;

  // Fetch dynamic context
  const { context, isLoading: contextLoading } = useAuthContext(contextSlug);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(
    loginHintParam ? decodeURIComponent(loginHintParam) : "",
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState(prefilledEmail);
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState(prefilledName);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Password reset states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  // Default to signup when coming from Wheel assessment or when context requests it
  const defaultToSignup = wheelCompleted;
  const [activeTab, setActiveTab] = useState<"login" | "signup">(defaultToSignup ? "signup" : "login");

  // Auto-switch to signup tab when auth context requests it
  useEffect(() => {
    if (!contextLoading && context.default_to_signup) {
      setActiveTab("signup");
    }
  }, [contextLoading, context.default_to_signup]);

  // Track if we gave up waiting for recovery session
  const [recoveryTimedOut, setRecoveryTimedOut] = useState(false);

  // Check for recovery session (user coming from password reset email)
  useEffect(() => {
    if (!resetMode) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let subscriptionCleanup: (() => void) | undefined;

    const checkRecoverySession = async () => {
      // Check if we have a recovery session from the URL hash/tokens
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // User has a valid session from the recovery link
        setIsRecoverySession(true);
      } else {
        // User is in reset mode but no session - wait for auth state change
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
            setIsRecoverySession(true);

            if (timeoutId) clearTimeout(timeoutId);
          }
        });

        subscriptionCleanup = () => subscription.unsubscribe();

        // Timeout fallback - if no recovery session after 5 seconds, redirect to login
        timeoutId = setTimeout(() => {

          setRecoveryTimedOut(true);
        }, 5000);
      }
    };

    checkRecoverySession();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (subscriptionCleanup) subscriptionCleanup();
    };
  }, [resetMode]);

  const { signIn, user, userRole, userRoles, registrationStatus, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to their appropriate dashboard (but not if in reset mode)
  useEffect(() => {
    if (!loading && user && userRole && !resetMode && !isRecoverySession) {
      // If there's a redirect param from a deep link, use that
      if (redirectParam) {
        navigate(decodeURIComponent(redirectParam), { replace: true });
        return;
      }
      // Otherwise, route based on role
      if (userRoles.includes("admin")) {
        navigate("/admin", { replace: true });
      } else if (userRoles.includes("instructor") || userRoles.includes("coach")) {
        navigate("/teaching", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, userRole, userRoles, loading, navigate, resetMode, isRecoverySession, redirectParam]);

  // If the user is signed in but role resolution hasn't completed yet, route appropriately.
  useEffect(() => {
    if (!loading && user && !userRole && !resetMode && !isRecoverySession) {
      // Google OAuth new user or pending role selection — go straight to registration.
      // Note: handle_new_user trigger sets registration_status='complete' (column default),
      // so we can't rely on !registrationStatus — just check zero roles + Google provider.
      const isOAuthNewUser = userRoles.length === 0 && user.app_metadata?.provider === "google";
      if (registrationStatus === "pending_role_selection" || isOAuthNewUser) {
        navigate("/complete-registration", { replace: true });
      } else {
        // Fall back to Index page for timeout-based fallbacks
        navigate("/", { replace: true });
      }
    }
  }, [loading, user, userRole, userRoles, registrationStatus, navigate, resetMode, isRecoverySession]);

  // Show a friendly error when OAuth redirects back with #error=...
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;

    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const error = params.get("error");
    if (!error) return;

    const errorDescription = params.get("error_description");
    const message = errorDescription
      ? decodeURIComponent(errorDescription)
      : "Authentication failed. Please try again.";

    toast.error(message);

    // Clear the hash without reloading
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, document.title, cleanUrl);

    setIsGoogleLoading(false);
  }, []);

  // Handle password reset
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = passwordResetSchema.parse({
        password: newPassword,
        confirmPassword: confirmPassword,
      });

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) {
        console.error("Password reset error:", error);
        toast.error(error.message || "Failed to reset password");
      } else {
        setResetComplete(true);
        toast.success("Password updated successfully!");

        // Clear the URL params and redirect after a short delay
        setTimeout(() => {
          navigate("/auth", { replace: true });
        }, 2000);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Password reset exception:", error);
        toast.error("An error occurred while resetting password");
      }
    }

    setIsLoading(false);
  };

  // Handle forgot password request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const currentOrigin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${currentOrigin}/auth?mode=reset`,
      });

      if (error) {
        toast.error(error.message || "Failed to send reset email");
      } else {
        setForgotPasswordSent(true);
        toast.success("Check your email for a password reset link.");
      }
    } catch (error) {
      console.error("Forgot password exception:", error);
      toast.error("An error occurred. Please try again.");
    }

    setIsLoading(false);
  };

  // Show loading while checking auth state or determining role
  if (loading) {
    return <PageLoadingState />;
  }

  // If in reset mode but no recovery session yet, show loading (with timeout fallback)
  if (resetMode && !isRecoverySession && !resetComplete && !recoveryTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">Setting up password reset...</div>
          <p className="text-sm text-muted-foreground">
            If this takes too long, try clicking the reset link in your email again.
          </p>
        </div>
      </div>
    );
  }

  // If recovery timed out, show message and redirect to login
  if (recoveryTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-foreground font-medium">Password reset link expired or invalid</div>
          <p className="text-sm text-muted-foreground">
            The password reset link may have expired or already been used. Please request a new
            password reset.
          </p>
          <Button
            onClick={() => {
              setRecoveryTimedOut(false);
              window.location.href = "/auth";
            }}
            className="mt-4"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  // If user is logged in and not in reset mode, never show a blank screen.
  // If role resolution is still in progress (userRole null), route to the app root
  // and let Index handle the final role-based redirect.
  if (user && !resetMode && !isRecoverySession) {
    if (!userRole) {
      // Avoid a blank /auth page while roles are being resolved.
      // Using navigate in an effect prevents render-time navigation warnings.
      // (The effect below will run immediately.)
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Signing you in...</div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const currentOrigin = window.location.origin;

      // Build query params to pass through for post-login redirect
      const queryParams: Record<string, string> = {};
      if (loginHintParam) {
        queryParams.login_hint = decodeURIComponent(loginHintParam);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${currentOrigin}/auth`,
          queryParams: {
            prompt: "select_account",
            ...queryParams,
          },
        },
      });

      if (error) {
        toast.error(error.message || "Failed to sign in with Google");
        setIsGoogleLoading(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign in with Google";
      toast.error(message);
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validated = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { error } = await signIn(validated.email, validated.password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Welcome back!");
        // Navigate to redirect param if provided, otherwise let Index route based on role
        if (redirectParam) {
          navigate(decodeURIComponent(redirectParam), { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred during login");
      }
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validated = signupSchema.parse({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });

      // Build signup metadata including context info
      const signupMetadata = {
        email: validated.email,
        password: validated.password,
        name: validated.name,
        // Context for post-signup processing
        context_slug: contextSlug,
        org_slug: orgSlug,
        track_param: trackParam,
        program_id: context.program_id,
        track_id: context.track_id,
        organization_id: context.organization_id,
        auto_enroll_program: context.auto_enroll_program,
        auto_assign_track: context.auto_assign_track,
        // UTM tracking
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        // Legacy params
        plan_interest: planInterest,
      };

      const { data, error } = await supabase.functions.invoke("signup-user", {
        body: signupMetadata,
      });

      // Check data.error first — supabase.functions.invoke populates data
      // with the response body even on non-2xx, but also sets error with a
      // generic "Edge Function returned a non-2xx status code" message
      if (data?.error) {
        toast.error(data.error);
      } else if (error) {
        toast.error("An error occurred during signup. Please try again.");
      } else {
        toast.success("Account created! Please check your email to confirm.");
        setSignupName("");
        setSignupEmail("");
        setSignupPassword("");
        setActiveTab("login");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred during signup");
      }
    }
    setIsLoading(false);
  };

  // Use dynamic features from context
  const features = context.features || [];

  // Determine branding
  const logoUrl = context.logo_url || "/assets/bef0efe8-8bee-45e0-a7b2-9067b165d1e8.png";
  const primaryColor = context.primary_color || "#0099FF";

  // Render password reset form if in reset mode with valid session
  const renderPasswordResetForm = () => (
    <div className="max-w-md mx-auto w-full">
      <div className="mb-6 sm:mb-8 text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <KeyRound className="h-8 w-8" style={{ color: primaryColor }} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          {resetComplete ? "Password Updated!" : "Set Your New Password"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          {resetComplete
            ? "Your password has been updated. Redirecting you to login..."
            : "Please enter your new password below."}
        </p>
      </div>

      {!resetComplete && (
        <form onSubmit={handlePasswordReset} className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter new password"
                className="pr-10 h-11 sm:h-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showNewPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm new password"
                className="pr-10 h-11 sm:h-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showConfirmPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full h-11 sm:h-12 text-base"
            style={{ backgroundColor: primaryColor }}
            disabled={isLoading}
          >
            {isLoading ? "Updating password..." : "Update Password"}
          </Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm">
        <button
          onClick={() => {
            setIsRecoverySession(false);
            navigate("/auth", { replace: true });
          }}
          className="font-semibold hover:underline text-muted-foreground"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-screen font-sans">
      {/* Top/Left Side - Branding */}
      <div className="w-full lg:w-1/2 bg-[#000040] text-white flex flex-col justify-between p-6 sm:p-8 lg:p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div
          className="absolute top-0 right-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
          style={{ backgroundColor: `${primaryColor}33` }}
        />
        <div
          className="absolute bottom-0 left-0 w-40 sm:w-60 lg:w-80 h-40 sm:h-60 lg:h-80 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"
          style={{ backgroundColor: `${primaryColor}1a` }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <img src={logoUrl} alt="InnoTrue Hub" className="h-12 sm:h-14 lg:h-16 w-auto" />
        </div>

        {/* Main Content */}
        <div className="relative z-10 space-y-6 sm:space-y-8 lg:space-y-10 my-8 lg:my-0">
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              {resetMode ? "Reset Your Password" : context.headline}
            </h1>
            {!resetMode && context.subheadline && (
              <p className="text-lg sm:text-xl text-white/90 italic">{context.subheadline}</p>
            )}
            {!resetMode && context.description && (
              <p className="text-sm sm:text-base lg:text-lg text-white/70 max-w-md hidden sm:block leading-relaxed">
                {context.description}
              </p>
            )}
            {resetMode && (
              <p className="text-sm sm:text-base lg:text-lg text-white/70 max-w-md leading-relaxed">
                Create a new secure password for your account.
              </p>
            )}
          </div>

          {/* Feature Cards - 2x2 grid on all sizes (hide in reset mode) */}
          {!resetMode && (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
              {features.map((feature, index) => {
                const IconComponent = iconMap[feature.icon] || Target;
                return (
                  <div
                    key={index}
                    className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-4 border border-white/10"
                  >
                    <IconComponent
                      className="h-4 w-4 sm:h-8 sm:w-8 mb-1 sm:mb-3"
                      style={{ color: primaryColor }}
                    />
                    <h3 className="font-semibold text-xs sm:text-base">{feature.title}</h3>
                    <p className="hidden sm:block text-sm text-white/70 line-clamp-2 leading-tight mt-1">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - hidden on mobile, shown on desktop */}
        <div className="relative z-10 text-sm text-white/50 hidden lg:block">
          © {new Date().getFullYear()} InnoTrue. All rights reserved.
        </div>
      </div>

      {/* Bottom/Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-6 sm:p-8 lg:p-16 bg-background flex-1">
        {/* Show password reset form or regular auth forms */}
        {resetMode && isRecoverySession ? (
          renderPasswordResetForm()
        ) : (
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {showForgotPassword
                  ? "Reset your password"
                  : activeTab === "login"
                    ? "Welcome back!"
                    : "Create your account"}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                {showForgotPassword
                  ? "Enter your email and we'll send you a reset link."
                  : activeTab === "login"
                    ? "Enter your credentials to access your account."
                    : "Start your evolution journey today."}
              </p>
            </div>

            {showForgotPassword ? (
              forgotPasswordSent ? (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Mail className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-foreground font-medium">Check your email</p>
                  <p className="text-sm text-muted-foreground">
                    We sent a password reset link to <strong>{forgotPasswordEmail}</strong>.
                    Click the link in the email to set a new password.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordSent(false);
                      setForgotPasswordEmail("");
                    }}
                    className="mt-4"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email address</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="h-11 sm:h-12"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 text-base"
                    style={{ backgroundColor: primaryColor }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending reset link..." : "Send Reset Link"}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotPasswordEmail("");
                      }}
                      className="text-sm font-semibold hover:underline text-muted-foreground"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )
            ) : activeTab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="h-11 sm:h-12"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setForgotPasswordEmail(loginEmail);
                      }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: primaryColor }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="pr-10 h-11 sm:h-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">
                        {showLoginPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 text-base"
                  style={{ backgroundColor: primaryColor }}
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 sm:h-12"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? "Connecting..." : "Continue with Google"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="h-11 sm:h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="h-11 sm:h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      className="pr-10 h-11 sm:h-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                    >
                      {showSignupPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">
                        {showSignupPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 text-base"
                  style={{ backgroundColor: primaryColor }}
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 sm:h-12"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? "Connecting..." : "Continue with Google"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              {activeTab === "login" ? (
                <p className="text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    onClick={() => setActiveTab("signup")}
                    className="font-semibold hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Create Account
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => setActiveTab("login")}
                    className="font-semibold hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>

            {/* Footer - shown on mobile/tablet */}
            <div className="lg:hidden mt-8 text-center text-xs sm:text-sm text-muted-foreground">
              © {new Date().getFullYear()} InnoTrue. All rights reserved.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
