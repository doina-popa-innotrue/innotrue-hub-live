import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const VerifyEmailChange = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("No verification token provided");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-email-change", {
          body: { token },
        });

        if (error) {
          throw error;
        }

        if (data.success) {
          setStatus("success");
          setMessage(
            "Your email has been successfully updated. Please log in again with your new email address.",
          );

          // Sign out user so they can log in with new email
          setTimeout(async () => {
            await supabase.auth.signOut();
            navigate("/auth");
          }, 3000);
        } else {
          throw new Error(data.error || "Verification failed");
        }
      } catch (error: any) {
        console.error("Verification error:", error);
        setStatus("error");
        setMessage(
          error.message || "Failed to verify email change. The link may be invalid or expired.",
        );
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {status === "error" && <XCircle className="h-5 w-5 text-destructive" />}
            {status === "loading" && "Verifying Email Change"}
            {status === "success" && "Email Updated Successfully"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please try requesting a new email change from your account settings.
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                Back to Login
              </Button>
            </div>
          )}
          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              Redirecting to login page in 3 seconds...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmailChange;
