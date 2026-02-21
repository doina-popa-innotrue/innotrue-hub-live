import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  GraduationCap,
  Building2,
  Loader2,
  CheckCircle2,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

type RoleChoice = "client" | "coach" | "instructor" | "both";

export default function CompleteRegistration() {
  const navigate = useNavigate();
  const { user, userRoles, loading: authLoading, signOut } = useAuth();

  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Coach/instructor application form
  const [requestType, setRequestType] = useState<"coach" | "instructor" | "both">("coach");
  const [specialties, setSpecialties] = useState("");
  const [certifications, setCertifications] = useState("");
  const [bio, setBio] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Fetch current registration status
  useEffect(() => {
    if (!user) return;
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("registration_status")
        .eq("id", user.id)
        .single();

      setRegistrationStatus(data?.registration_status ?? null);
      setStatusLoading(false);

      // If already complete AND user has roles, redirect to dashboard.
      // Google OAuth new users have registration_status='complete' (set by handle_new_user
      // trigger default) but zero roles — they still need to pick a role here.
      if (
        (data?.registration_status === "complete" || data?.registration_status === "pending_approval") &&
        userRoles.length > 0
      ) {
        navigate("/dashboard", { replace: true });
      }
    };
    fetchStatus();
  }, [user, navigate]);

  const handleCompleteRegistration = async (roleChoice: RoleChoice) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const payload: Record<string, string | undefined> = {
        role_choice: roleChoice,
      };

      if (roleChoice !== "client") {
        payload.role_choice = requestType;
        payload.specialties = specialties || undefined;
        payload.certifications = certifications || undefined;
        payload.bio = bio || undefined;
        payload.scheduling_url = schedulingUrl || undefined;
        payload.message = applicationMessage || undefined;
      }

      const { data, error } = await supabase.functions.invoke("complete-registration", {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || "Registration failed");
      }

      if (data?.already_complete) {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (roleChoice === "client") {
        toast.success("Welcome to InnoTrue! Let's get started.");
      } else {
        toast.success(
          "Welcome! Your coach/instructor application is under review. You can start using the platform as a client.",
        );
      }

      // Small delay so toast is visible, then redirect
      setTimeout(() => {
        // Force page reload to pick up new roles in AuthContext
        window.location.href = "/dashboard";
      }, 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading states
  if (authLoading || statusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
      {/* Sign out button */}
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to InnoTrue</h1>
          <p className="text-muted-foreground">
            How would you like to use the platform?
          </p>
        </div>

        {/* Role selection cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Client card */}
          <Card
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
              selectedRole === "client" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedRole("client")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">I'm here to grow</CardTitle>
              <CardDescription className="text-sm">
                Access programs, assessments, coaching sessions, and development tools
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {selectedRole === "client" && (
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteRegistration("client");
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Get Started
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Coach/Instructor card */}
          <Card
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
              selectedRole === "coach" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedRole("coach")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <GraduationCap className="h-6 w-6 text-amber-600" />
              </div>
              <CardTitle className="text-lg">I'm a Coach or Instructor</CardTitle>
              <CardDescription className="text-sm">
                Teach, coach, and guide learners through programs and assessments
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {selectedRole !== "coach" && (
                <p className="text-xs text-muted-foreground">Click to apply</p>
              )}
            </CardContent>
          </Card>

          {/* Organization card (coming soon) */}
          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg">I represent an Organization</CardTitle>
              <CardDescription className="text-sm">
                Manage teams, sponsor programs, and track organization-wide progress
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Coming soon
              </span>
              <p className="mt-2 text-xs text-muted-foreground">
                Contact us for organization registration.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Coach/Instructor application form */}
        {selectedRole === "coach" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Coach / Instructor Application</CardTitle>
              <CardDescription>
                Tell us about yourself. You'll get immediate access to the platform as a client while your application is reviewed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requestType">I'd like to be a</Label>
                <Select
                  value={requestType}
                  onValueChange={(v) => setRequestType(v as "coach" | "instructor" | "both")}
                >
                  <SelectTrigger id="requestType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="both">Both Coach & Instructor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Professional Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Brief description of your background and approach..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="specialties">Specialties</Label>
                  <Input
                    id="specialties"
                    placeholder="e.g. Leadership, Team building"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="certifications">Certifications</Label>
                  <Input
                    id="certifications"
                    placeholder="e.g. ICF PCC, ATD CPLP"
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedulingUrl">Scheduling URL (optional)</Label>
                <Input
                  id="schedulingUrl"
                  type="url"
                  placeholder="https://cal.com/your-name"
                  value={schedulingUrl}
                  onChange={(e) => setSchedulingUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Additional Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Anything else you'd like us to know..."
                  value={applicationMessage}
                  onChange={(e) => setApplicationMessage(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  You'll get immediate platform access as a client. Once approved, your coach/instructor tools will be unlocked.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => handleCompleteRegistration(requestType)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Submit Application & Get Started
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
