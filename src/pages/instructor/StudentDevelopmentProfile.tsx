import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StrengthsGapsMatrix } from "@/components/development-profile/StrengthsGapsMatrix";
import { PsychometricScores } from "@/components/development-profile/PsychometricScores";
import { MyReadiness } from "@/components/development-profile/MyReadiness";
import { ActiveDevelopmentItems } from "@/components/development-profile/ActiveDevelopmentItems";
import { AssessmentGoalProgress } from "@/components/development-profile/AssessmentGoalProgress";
import { SkillsEarned } from "@/components/development-profile/SkillsEarned";
import { GuidedPathProgress } from "@/components/development-profile/GuidedPathProgress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function StudentDevelopmentProfile() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();

  // Resolve the enrollment to get the client user ID and name
  const { data: enrollment, isLoading } = useQuery({
    queryKey: ["enrollment-user", enrollmentId],
    queryFn: async () => {
      if (!enrollmentId) return null;

      const { data, error } = await supabase
        .from("client_enrollments")
        .select(
          `
          id, client_user_id,
          profiles:client_user_id(full_name, avatar_url)
        `,
        )
        .eq("id", enrollmentId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!enrollmentId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!enrollment?.client_user_id) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Enrollment not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  const clientUserId = enrollment.client_user_id;
  const clientName =
    (enrollment.profiles as any)?.full_name || "Student";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {clientName}&apos;s Development Profile
          </h1>
          <p className="text-muted-foreground">
            Unified view of strengths, gaps, goals, and development progress.
          </p>
        </div>
      </div>

      {/* Same sections, but for the student's userId */}
      <StrengthsGapsMatrix userId={clientUserId} />
      <PsychometricScores userId={clientUserId} allowEntry />
      <ActiveDevelopmentItems userId={clientUserId} />
      <AssessmentGoalProgress userId={clientUserId} />
      <SkillsEarned userId={clientUserId} />
      <GuidedPathProgress userId={clientUserId} />
      <MyReadiness userId={clientUserId} />
    </div>
  );
}
