import { useAuth } from "@/contexts/AuthContext";
import { FeatureGate } from "@/components/FeatureGate";
import { MyReadiness } from "@/components/development-profile/MyReadiness";
import { StrengthsGapsMatrix } from "@/components/development-profile/StrengthsGapsMatrix";
import { PsychometricScores } from "@/components/development-profile/PsychometricScores";
import { ActiveDevelopmentItems } from "@/components/development-profile/ActiveDevelopmentItems";
import { AssessmentGoalProgress } from "@/components/development-profile/AssessmentGoalProgress";
import { SkillsEarned } from "@/components/development-profile/SkillsEarned";
import { GuidedPathProgress } from "@/components/development-profile/GuidedPathProgress";
import { BarChart3 } from "lucide-react";
import ClientBadgesSection from "@/components/badges/ClientBadgesSection";

export default function DevelopmentProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <FeatureGate featureKey="development_profile">
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Development Profile
          </h1>
          <p className="text-muted-foreground">
            Your unified view of strengths, gaps, goals, and development
            progress.
          </p>
        </div>
      </div>

      {/* Section A: Strengths & Gaps Matrix */}
      <StrengthsGapsMatrix userId={user.id} />

      {/* Section F: Psychometric Scores */}
      <PsychometricScores userId={user.id} />

      {/* Section B: Active Development Items */}
      <ActiveDevelopmentItems userId={user.id} />

      {/* Section C: Assessment-Linked Goal Progress */}
      <AssessmentGoalProgress userId={user.id} />

      {/* Section D: Skills Earned */}
      <SkillsEarned userId={user.id} />

      {/* Section D2: Badges & Certifications */}
      <ClientBadgesSection />

      {/* Section E: Guided Path Progress */}
      <GuidedPathProgress userId={user.id} />

      {/* Section G: My Readiness */}
      <MyReadiness userId={user.id} />
    </div>
    </FeatureGate>
  );
}
