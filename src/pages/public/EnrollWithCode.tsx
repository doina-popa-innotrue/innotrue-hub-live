import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Loader2,
  Ticket,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ValidationResult {
  valid: boolean;
  code: string;
  program_id: string;
  program_name: string;
  program_slug: string;
  is_free: boolean;
  discount_percent: number | null;
  grants_tier: string | null;
  cohort_id: string | null;
  error?: string;
}

type PageStatus =
  | "input"      // No code provided — show code input
  | "validating" // Auto-validating code from URL
  | "valid"      // Code validated — show program info + enroll button
  | "enrolling"  // Calling edge function
  | "enrolled"   // Success!
  | "error";     // Validation or enrollment error

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EnrollWithCode() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<PageStatus>("input");
  const [codeInput, setCodeInput] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [enrollmentResult, setEnrollmentResult] = useState<{
    program_name: string;
    program_slug: string;
    program_id: string;
  } | null>(null);

  const urlCode = searchParams.get("code");

  // -----------------------------------------------------------------------
  // Auto-validate code from URL on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (urlCode) {
      setCodeInput(urlCode.toUpperCase());
      validateCode(urlCode);
    }
  }, [urlCode]);

  // -----------------------------------------------------------------------
  // Validate via RPC
  // -----------------------------------------------------------------------
  const validateCode = async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) {
      setErrorMessage("Please enter an enrollment code");
      setStatus("error");
      return;
    }

    setStatus("validating");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc("validate_enrollment_code", {
        p_code: cleaned,
      });

      if (error) {
        setErrorMessage("Failed to validate code. Please try again.");
        setStatus("error");
        return;
      }

      const result = data as unknown as ValidationResult;

      if (!result || !result.valid) {
        setErrorMessage(result?.error || "Invalid enrollment code");
        setStatus("error");
        return;
      }

      setValidation(result);
      setStatus("valid");
    } catch (err) {
      console.error("Validation error:", err);
      setErrorMessage("An unexpected error occurred. Please try again.");
      setStatus("error");
    }
  };

  // -----------------------------------------------------------------------
  // Redeem via edge function
  // -----------------------------------------------------------------------
  const handleEnroll = async () => {
    if (!user) {
      // Redirect to auth, come back here after login
      const codeParam = validation?.code || codeInput;
      navigate(`/auth?redirect=/enroll?code=${encodeURIComponent(codeParam)}`);
      return;
    }

    setStatus("enrolling");

    try {
      const { data, error } = await supabase.functions.invoke("redeem-enrollment-code", {
        body: { code: validation?.code || codeInput.toUpperCase() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.success) {
        throw new Error(data?.message || "Enrollment failed");
      }

      setEnrollmentResult({
        program_name: data.program_name,
        program_slug: data.program_slug,
        program_id: data.program_id,
      });
      setStatus("enrolled");
      toast.success(`Successfully enrolled in ${data.program_name}!`);
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setErrorMessage(err.message || "Failed to enroll. Please try again.");
      setStatus("error");
    }
  };

  // -----------------------------------------------------------------------
  // Handle code submission from input form
  // -----------------------------------------------------------------------
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim()) {
      validateCode(codeInput);
    }
  };

  // -----------------------------------------------------------------------
  // Loading state (auth loading or validating)
  // -----------------------------------------------------------------------
  if (authLoading || status === "validating") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {status === "validating" ? "Validating enrollment code..." : "Loading..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Code</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setStatus("input");
                setErrorMessage("");
                setCodeInput("");
              }}
            >
              Try a Different Code
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Success state
  // -----------------------------------------------------------------------
  if (status === "enrolled" && enrollmentResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>You're Enrolled!</CardTitle>
            <CardDescription>
              You have successfully enrolled in{" "}
              <strong>{enrollmentResult.program_name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() =>
                navigate(
                  enrollmentResult.program_slug
                    ? `/programs/${enrollmentResult.program_slug}`
                    : `/programs/${enrollmentResult.program_id}`,
                )
              }
            >
              Go to Program
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Code input form (no code in URL)
  // -----------------------------------------------------------------------
  if (status === "input") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Enter Enrollment Code</CardTitle>
            <CardDescription>
              Enter the code you received to enroll in a program
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enrollment-code">Enrollment Code</Label>
                <Input
                  id="enrollment-code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ENRABCDEF"
                  className="font-mono text-center text-lg tracking-wider"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!codeInput.trim()}
              >
                Validate Code
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Valid code — show program info + enroll button
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Enroll in Program</CardTitle>
          <CardDescription>
            You're about to enroll using code{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-sm">
              {validation?.code}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Program info card */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="text-sm text-muted-foreground">Program</div>
            <div className="font-semibold text-lg">{validation?.program_name}</div>

            <div className="flex flex-wrap gap-2 mt-2">
              {validation?.is_free ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Free Enrollment
                </Badge>
              ) : validation?.discount_percent === 100 ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Free (100% off)
                </Badge>
              ) : validation?.discount_percent ? (
                <Badge variant="outline">{validation.discount_percent}% discount</Badge>
              ) : null}

              {validation?.grants_tier && (
                <Badge variant="secondary">{validation.grants_tier} tier</Badge>
              )}
            </div>
          </div>

          {/* Auth-dependent action */}
          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Please sign in to complete your enrollment.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  const codeParam = validation?.code || codeInput;
                  navigate(`/auth?redirect=/enroll?code=${encodeURIComponent(codeParam)}`);
                }}
              >
                Sign In to Enroll
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Signed in as <strong>{user.email}</strong>
              </p>
              <Button
                className="w-full"
                onClick={handleEnroll}
                disabled={status === "enrolling"}
              >
                {status === "enrolling" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    Enroll Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
