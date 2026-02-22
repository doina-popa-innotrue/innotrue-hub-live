import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  Lock,
  ChevronRight,
  Users,
  Crown,
  ArrowUp,
  Filter,
  Link2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useTalentLmsProgress } from "@/hooks/useTalentLmsProgress";
import { useCrossProgramCompletion } from "@/hooks/useCrossProgramCompletion";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { TermsAcceptanceGate } from "@/components/terms/TermsAcceptanceGate";
import { hasTierAccess, getTierDisplayName } from "@/lib/tierUtils";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ProgramTeamContact } from "@/components/programs/ProgramTeamContact";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { PlanLockOverlay } from "@/components/programs/PlanLockOverlay";
import { PlanLockBadge } from "@/components/programs/PlanLockBadge";
import { TierUpgradeDialog } from "@/components/programs/TierUpgradeDialog";
import { useQuery } from "@tanstack/react-query";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";

interface ModuleLink {
  name: string;
  url: string;
  type: "zoom" | "talentlms" | "circle" | "lucidchart" | "miro" | "gdrive" | "other";
}

interface Module {
  id: string;
  title: string;
  description: string;
  module_type: string;
  order_index: number;
  estimated_minutes: number;
  tier_required: string;
  is_individualized?: boolean;
  links?: ModuleLink[];
  progress?: {
    id: string;
    status: string;
    notes: string | null;
  };
  prerequisites?: string[]; // IDs of prerequisite modules
  plan_id?: string | null;
  min_plan_tier?: number;
  available_from_date?: string | null;
  unlock_after_days?: number | null;
}

export default function ProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!id) return null;
  const { user, userRole } = useAuth();
  const [program, setProgram] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [cohortInfo, setCohortInfo] = useState<{
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [programPlanAccess, setProgramPlanAccess] = useState<{
    isLocked: boolean;
    reason:
      | "plan_required"
      | "payment_outstanding"
      | "separate_purchase_required"
      | "enrollment_paused"
      | null;
    requiredTier: number;
    requiresSeparatePurchase?: boolean;
  } | null>(null);
  const [modulePlanAccessMap, setModulePlanAccessMap] = useState<Record<string, boolean>>({});
  const [showOnlyAccessible, setShowOnlyAccessible] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
  const [pendingUpgradeRequest, setPendingUpgradeRequest] = useState<any>(null);
  const { progress: talentLmsProgress, syncing, syncProgress } = useTalentLmsProgress(user?.id);
  const {
    checkProgramAccess,
    getPlanNameForTier,
    userPlan,
    isLoading: planAccessLoading,
    checkModulePlanAccess,
  } = usePlanAccess();
  const { getModuleCrossCompletions, isCompletedElsewhere, crossCompletedCount } =
    useCrossProgramCompletion(user?.id, id);

  // Fetch module types that require sessions (have Cal.com mapping)
  const { data: sessionCapableTypes } = useQuery({
    queryKey: ["session-capable-module-types"],
    queryFn: async () => {
      const { data } = await supabase
        .from("calcom_event_type_mappings")
        .select("module_type")
        .eq("is_active", true);
      return new Set(data?.map((m) => m.module_type) || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch module sessions for this enrollment
  const { data: moduleSessions } = useQuery({
    queryKey: ["enrollment-module-sessions", enrollment?.id],
    queryFn: async () => {
      if (!enrollment?.id) return {};

      // Fetch individual sessions for this enrollment
      const { data: individualSessions } = await supabase
        .from("module_sessions")
        .select("module_id, status, session_date")
        .eq("enrollment_id", enrollment.id)
        .neq("status", "cancelled");

      // Fetch group sessions where user is a participant
      const { data: participantSessions } = await supabase
        .from("module_session_participants")
        .select("module_sessions(module_id, status, session_date)")
        .eq("user_id", user!.id);

      // Build a map of module_id -> session info
      const sessionMap: Record<
        string,
        { hasSession: boolean; hasUpcoming: boolean; status?: string }
      > = {};

      individualSessions?.forEach((s) => {
        const hasUpcoming = s.session_date && new Date(s.session_date) > new Date();
        sessionMap[s.module_id] = {
          hasSession: true,
          hasUpcoming: hasUpcoming || false,
          status: s.status,
        };
      });

      participantSessions?.forEach((p) => {
        const session = (p as any).module_sessions;
        if (session) {
          const hasUpcoming = session.session_date && new Date(session.session_date) > new Date();
          if (!sessionMap[session.module_id]) {
            sessionMap[session.module_id] = {
              hasSession: true,
              hasUpcoming: hasUpcoming || false,
              status: session.status,
            };
          } else if (hasUpcoming) {
            sessionMap[session.module_id].hasUpcoming = true;
          }
        }
      });

      return sessionMap;
    },
    enabled: !!enrollment?.id && !!user?.id,
  });

  useEffect(() => {
    async function fetchData() {
      if (!user || !id) return;
      const { data: programData } = await supabase
        .from("programs")
        .select("*, plan_id, min_plan_tier, requires_separate_purchase")
        .eq("id", id)
        .single();
      const { data: enrollmentData } = await supabase
        .from("client_enrollments")
        .select("*")
        .eq("client_user_id", user.id)
        .eq("program_id", id)
        .single();
      const { data: modulesData } = await supabase
        .from("program_modules")
        .select("*, plan_id, min_plan_tier, available_from_date, unlock_after_days")
        .eq("program_id", id)
        .order("order_index");

      // Fetch all prerequisites for modules in this program
      const { data: prereqsData } = await supabase
        .from("module_prerequisites")
        .select("module_id, prerequisite_module_id");

      // Create a map of module_id -> prerequisite_module_ids
      const prereqMap = new Map<string, string[]>();
      prereqsData?.forEach((prereq) => {
        const existing = prereqMap.get(prereq.module_id) || [];
        existing.push(prereq.prerequisite_module_id);
        prereqMap.set(prereq.module_id, existing);
      });

      if (modulesData && enrollmentData) {
        const enrichedModules = await Promise.all(
          modulesData.map(async (module) => {
            const { data: progressData } = await supabase
              .from("module_progress")
              .select("*")
              .eq("enrollment_id", enrollmentData.id)
              .eq("module_id", module.id)
              .maybeSingle();
            return {
              ...module,
              links: (module.links as unknown as ModuleLink[]) || [],
              progress: progressData,
              prerequisites: prereqMap.get(module.id) || [],
              plan_id: module.plan_id,
              min_plan_tier: module.min_plan_tier || 0,
              available_from_date: module.available_from_date,
              unlock_after_days: module.unlock_after_days,
            };
          }),
        );
        setModules(enrichedModules as Module[]);
      }
      setProgram(programData);
      setEnrollment(enrollmentData);

      // Load cohort info if enrollment has a cohort
      if (enrollmentData?.cohort_id) {
        const { data: cohortData } = await supabase
          .from("program_cohorts")
          .select("name, start_date, end_date, status")
          .eq("id", enrollmentData.cohort_id)
          .single();
        if (cohortData) {
          setCohortInfo(cohortData);
        }
      }

      setLoading(false);
    }
    fetchData();
  }, [user, id]);

  // Check program plan access
  useEffect(() => {
    if (planAccessLoading || !program) return;

    const checkAccess = async () => {
      const access = await checkProgramAccess(
        program.id,
        program.plan_id,
        program.min_plan_tier || 0,
        program.requires_separate_purchase || false,
      );
      setProgramPlanAccess({
        isLocked: access.isLocked,
        reason: access.reason,
        requiredTier: access.requiredPlanTier,
        requiresSeparatePurchase: access.requiresSeparatePurchase,
      });
    };

    checkAccess();
  }, [planAccessLoading, program, checkProgramAccess]);

  // Check module plan access for all modules
  useEffect(() => {
    if (planAccessLoading || !program || modules.length === 0) return;

    const checkModuleAccess = async () => {
      const accessMap: Record<string, boolean> = {};
      await Promise.all(
        modules.map(async (module) => {
          const hasAccess = await checkModulePlanAccess(
            module.id,
            program.id,
            module.plan_id || null,
            module.min_plan_tier || 0,
          );
          accessMap[module.id] = hasAccess;
        }),
      );
      setModulePlanAccessMap(accessMap);
    };

    checkModuleAccess();
  }, [planAccessLoading, program, modules, checkModulePlanAccess]);

  // Fetch pending tier upgrade request
  useEffect(() => {
    async function fetchUpgradeRequest() {
      if (!user || !enrollment) return;

      const { data } = await supabase
        .from("tier_upgrade_requests")
        .select("*")
        .eq("enrollment_id", enrollment.id)
        .eq("status", "pending")
        .maybeSingle();

      setPendingUpgradeRequest(data);
    }

    fetchUpgradeRequest();
  }, [user, enrollment]);

  // Helper to check if a module is accessible based on tier, plan, prerequisites, and time-gate
  const isModuleAccessible = (module: Module): boolean => {
    const programTiers = program?.tiers as string[] | undefined;
    const isTierLocked = !hasTierAccess(programTiers, enrollment?.tier, module.tier_required);
    const isModulePlanLocked = modulePlanAccessMap[module.id] === false;
    const moduleTimeGated = isTimeGated(module);
    const prereqsMet = arePrerequisitesMet(module);
    return !isTierLocked && !isModulePlanLocked && !moduleTimeGated && prereqsMet;
  };

  // Calculate progress based on accessible modules only
  const accessibleModules = modules.filter((m) => isModuleAccessible(m));
  const accessibleCompletedCount = accessibleModules.filter(
    (m) => m.progress?.status === "completed",
  ).length;
  const accessibleProgressPercentage =
    accessibleModules.length > 0 ? (accessibleCompletedCount / accessibleModules.length) * 100 : 0;

  // Total modules stats (for reference)
  const totalCompletedCount = modules.filter((m) => m.progress?.status === "completed").length;
  const lockedModulesCount = modules.length - accessibleModules.length;

  // Filter modules for display
  const displayedModules = showOnlyAccessible
    ? modules.filter((m) => isModuleAccessible(m))
    : modules;

  // Handle tier upgrade request
  const handleTierUpgradeRequest = async (selectedTier: string, reason: string) => {
    if (!user || !enrollment) return;

    setIsSubmittingUpgrade(true);
    try {
      const { error } = await supabase.from("tier_upgrade_requests").insert({
        user_id: user.id,
        enrollment_id: enrollment.id,
        current_tier: enrollment.tier || "essentials",
        requested_tier: selectedTier,
        reason: reason || null,
      });

      if (error) throw error;

      toast.success("Upgrade request submitted! An administrator will review your request.");
      setShowUpgradeDialog(false);

      // Refresh pending request
      const { data } = await supabase
        .from("tier_upgrade_requests")
        .select("*")
        .eq("enrollment_id", enrollment.id)
        .eq("status", "pending")
        .maybeSingle();

      setPendingUpgradeRequest(data);
    } catch (error: any) {
      console.error("Error submitting upgrade request:", error);
      if (error.code === "23505") {
        toast.error("You already have a pending upgrade request for this program.");
      } else {
        toast.error("Failed to submit upgrade request. Please try again.");
      }
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  const getTalentLmsCourseId = (module: Module): string | null => {
    const talentLmsLink = module.links?.find((link) => link.type === "talentlms");
    if (!talentLmsLink) return null;
    const match = talentLmsLink.url.match(/id:(\d+)/);
    return match ? match[1] : null;
  };

  const getModuleProgress = (module: Module): number => {
    // If module has TalentLMS link, use that progress
    const courseId = getTalentLmsCourseId(module);
    if (courseId) {
      const tlmsProgress = talentLmsProgress.find((p) => p.talentlms_course_id === courseId);
      if (tlmsProgress) {
        return tlmsProgress.progress_percentage || 0;
      }
    }

    // Otherwise, use completion status
    if (module.progress?.status === "completed") return 100;
    if (module.progress?.status === "in_progress") return 50;
    return 0;
  };

  // Check if all prerequisite modules are completed
  const arePrerequisitesMet = (module: Module): boolean => {
    if (!module.prerequisites || module.prerequisites.length === 0) return true;

    return module.prerequisites.every((prereqId) => {
      const prereqModule = modules.find((m) => m.id === prereqId);
      return prereqModule?.progress?.status === "completed";
    });
  };

  // Get incomplete prerequisites for display
  const getIncompletePrerequisites = (module: Module): Module[] => {
    if (!module.prerequisites || module.prerequisites.length === 0) return [];

    return module.prerequisites
      .map((prereqId) => modules.find((m) => m.id === prereqId))
      .filter((m): m is Module => m !== undefined && m.progress?.status !== "completed");
  };

  // Check if a module is time-gated (not yet available)
  const isTimeGated = (module: Module): boolean => {
    const now = new Date();
    // Check absolute date gate
    if (module.available_from_date) {
      const availableDate = new Date(module.available_from_date);
      if (now < availableDate) return true;
    }
    // Check relative date gate (days after enrollment)
    if (module.unlock_after_days != null && module.unlock_after_days > 0 && enrollment?.created_at) {
      const enrollmentDate = new Date(enrollment.created_at);
      const unlockDate = new Date(enrollmentDate);
      unlockDate.setDate(unlockDate.getDate() + module.unlock_after_days);
      if (now < unlockDate) return true;
    }
    return false;
  };

  // Get the unlock date for display (returns the later of the two gates)
  const getUnlockDate = (module: Module): Date | null => {
    let latestDate: Date | null = null;

    if (module.available_from_date) {
      const d = new Date(module.available_from_date);
      if (!latestDate || d > latestDate) latestDate = d;
    }
    if (module.unlock_after_days != null && module.unlock_after_days > 0 && enrollment?.created_at) {
      const enrollmentDate = new Date(enrollment.created_at);
      const d = new Date(enrollmentDate);
      d.setDate(d.getDate() + module.unlock_after_days);
      if (!latestDate || d > latestDate) latestDate = d;
    }
    return latestDate;
  };

  if (loading) return <PageLoadingState message="Loading program..." />;
  if (!program) return <ErrorState title="Program not found" description="The program you're looking for doesn't exist or has been removed." />;

  // Show lock overlay if enrollment is paused
  if (enrollment?.status === "paused") {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/programs")} className="cursor-pointer">
                Programs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{program.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{program.name}</CardTitle>
                <RichTextDisplay content={program.description} className="text-muted-foreground" />
              </div>
              <PlanLockBadge requiredPlanName="" reason="enrollment_paused" showTooltip={false} />
            </div>
          </CardHeader>
        </Card>

        <PlanLockOverlay
          reason="enrollment_paused"
          requiredPlanName=""
          userPlanName={userPlan?.name}
        />
      </div>
    );
  }

  // Show plan lock overlay if access is blocked
  if (programPlanAccess?.isLocked) {
    const requiredPlanName = getPlanNameForTier(programPlanAccess.requiredTier);
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/programs")} className="cursor-pointer">
                Programs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{program.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{program.name}</CardTitle>
                <RichTextDisplay content={program.description} className="text-muted-foreground" />
              </div>
              <PlanLockBadge
                requiredPlanName={requiredPlanName}
                reason={programPlanAccess.reason}
                showTooltip={false}
              />
            </div>
          </CardHeader>
        </Card>

        <PlanLockOverlay
          reason={programPlanAccess.reason!}
          requiredPlanName={requiredPlanName}
          userPlanName={userPlan?.name}
        />
      </div>
    );
  }

  const programTiers = program?.tiers as string[] | undefined;

  return (
    <TermsAcceptanceGate programId={id!}>
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate("/programs")} className="cursor-pointer">
                Programs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{program.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="mb-6">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <CardTitle className="text-xl sm:text-2xl">{program.name}</CardTitle>
                {userRole === "admin" && (
                  <Button
                    onClick={syncProgress}
                    disabled={syncing}
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start"
                  >
                    {syncing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Sync Academy
                  </Button>
                )}
              </div>
              <RichTextDisplay content={program.description} className="text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress based on accessible modules */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                  <span className="text-muted-foreground">Your Progress</span>
                  <span className="font-medium">
                    {accessibleCompletedCount} / {accessibleModules.length} accessible modules
                  </span>
                </div>
                <Progress value={accessibleProgressPercentage} />
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-muted-foreground">
                  <span>{Math.round(accessibleProgressPercentage)}% complete</span>
                  {lockedModulesCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {lockedModulesCount} module{lockedModulesCount !== 1 ? "s" : ""} require
                      upgrade
                    </span>
                  )}
                </div>
              </div>

              {/* Upgrade request section */}
              {lockedModulesCount > 0 && programTiers && programTiers.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">
                      {getTierDisplayName(programTiers, enrollment?.tier)}
                    </Badge>
                    <span className="text-muted-foreground">Current tier</span>
                  </div>
                  {pendingUpgradeRequest ? (
                    <Badge variant="secondary" className="gap-1 self-start sm:self-auto">
                      <Clock className="h-3 w-3" />
                      Upgrade request pending
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUpgradeDialog(true)}
                      className="gap-1 self-start sm:self-auto"
                    >
                      <ArrowUp className="h-4 w-4" />
                      Request Upgrade
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Program Team Contact */}
        <ProgramTeamContact
          programId={id!}
          modules={modules.map((m) => ({ id: m.id, title: m.title }))}
          showModuleTeams={true}
        />

        {/* Cohort Schedule Card */}
        {cohortInfo && (
          <Card className="border-primary/30 bg-primary/5 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/programs/${id}/cohort`)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{cohortInfo.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {cohortInfo.start_date && cohortInfo.end_date
                        ? `${format(new Date(cohortInfo.start_date), "MMM d")} – ${format(new Date(cohortInfo.end_date), "MMM d, yyyy")}`
                        : "Live cohort schedule"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View Schedule
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cross-program completion notice */}
        {crossCompletedCount > 0 && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-500/10 p-2">
                  <Link2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    {crossCompletedCount} module{crossCompletedCount !== 1 ? "s" : ""} already
                    completed
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You've completed equivalent content in other programs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter controls */}
        {lockedModulesCount > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="accessible-filter"
                checked={showOnlyAccessible}
                onCheckedChange={setShowOnlyAccessible}
              />
              <Label htmlFor="accessible-filter" className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Show only accessible modules
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {displayedModules.length} of {modules.length} modules shown
            </span>
          </div>
        )}

        <div className="space-y-4">
          {displayedModules.map((module, index) => {
            const isTierLocked = !hasTierAccess(
              programTiers,
              enrollment?.tier,
              module.tier_required,
            );
            const isModulePlanLocked = modulePlanAccessMap[module.id] === false;
            const prereqsMet = arePrerequisitesMet(module);
            const moduleTimeGated = isTimeGated(module);
            const moduleUnlockDate = moduleTimeGated ? getUnlockDate(module) : null;
            const isLocked = isTierLocked || !prereqsMet || isModulePlanLocked || moduleTimeGated;
            const incompletePrereqs = getIncompletePrerequisites(module);
            const moduleProgress = getModuleProgress(module);
            const showProgress = !isLocked && moduleProgress > 0;
            const requiredTierName = getTierDisplayName(programTiers, module.tier_required);
            const requiredPlanName = module.min_plan_tier
              ? getPlanNameForTier(module.min_plan_tier)
              : "";

            // Cross-program completion check
            const crossCompletions = getModuleCrossCompletions(module.id);
            const hasElsewhereCompletion =
              crossCompletions.length > 0 && module.progress?.status !== "completed";

            // Session status check
            const moduleRequiresSession = sessionCapableTypes?.has(module.module_type) || false;
            const moduleSessionInfo = moduleSessions?.[module.id];
            const hasScheduledSession = moduleSessionInfo?.hasUpcoming || false;
            const hasAnySession = moduleSessionInfo?.hasSession || false;
            const needsSession =
              moduleRequiresSession &&
              !hasAnySession &&
              !isLocked &&
              module.progress?.status !== "completed";

            // Find original index for module numbering
            const originalIndex = modules.findIndex((m) => m.id === module.id);

            return (
              <Card
                key={module.id}
                className={`transition-all hover:shadow-md ${isLocked ? "opacity-60 border-dashed" : "cursor-pointer"}`}
                onClick={() => !isLocked && navigate(`/programs/${id}/modules/${module.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">
                          Module {originalIndex + 1}
                        </span>
                        <Badge variant="outline">{module.module_type}</Badge>
                        {module.is_individualized && (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-600 border-blue-500/20"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Personalised
                          </Badge>
                        )}
                        {/* Session status indicators */}
                        {!isLocked && module.progress?.status !== "completed" && (
                          <>
                            {hasScheduledSession && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="gap-1 bg-primary/10 text-primary border-primary/20"
                                  >
                                    <Calendar className="h-3 w-3" />
                                    Session Scheduled
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Upcoming session is scheduled</TooltipContent>
                              </Tooltip>
                            )}
                            {needsSession && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="gap-1 bg-warning/10 text-warning border-warning/20"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    Session Required
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Book a session to continue</TooltipContent>
                              </Tooltip>
                            )}
                          </>
                        )}
                        {isModulePlanLocked ? (
                          <PlanLockBadge
                            requiredPlanName={requiredPlanName}
                            reason="plan_required"
                          />
                        ) : isTierLocked ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            {requiredTierName}
                          </Badge>
                        ) : !prereqsMet ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Prerequisites Required
                          </Badge>
                        ) : moduleTimeGated ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Available {moduleUnlockDate ? format(moduleUnlockDate, "MMM d") : "soon"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {moduleUnlockDate
                                ? `This module unlocks on ${format(moduleUnlockDate, "MMMM d, yyyy")}`
                                : "This module is not yet available"}
                            </TooltipContent>
                          </Tooltip>
                        ) : module.progress?.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : hasElsewhereCompletion ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="gap-1 bg-green-500/10 text-green-600 border-green-500/20"
                              >
                                <Link2 className="h-3 w-3" />
                                Completed elsewhere
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-medium mb-1">Completed in another program:</p>
                              {crossCompletions.slice(0, 3).map((cc, idx) => (
                                <p key={idx} className="text-xs text-muted-foreground">
                                  • {cc.programName}
                                </p>
                              ))}
                              {crossCompletions.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  +{crossCompletions.length - 3} more
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <CardTitle className="mt-2">{module.title}</CardTitle>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{module.estimated_minutes} minutes</span>
                      </div>
                      {showProgress && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{moduleProgress}%</span>
                          </div>
                          <Progress value={moduleProgress} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    {!isLocked && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </CardHeader>
                {isModulePlanLocked && (
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Crown className="h-8 w-8 text-amber-500" />
                        <p className="text-sm font-medium">{requiredPlanName} Plan Required</p>
                        <p className="text-xs text-muted-foreground">
                          Upgrade to {requiredPlanName} to access this module
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
                {!isModulePlanLocked && isTierLocked && (
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Lock className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">{requiredTierName} Content</p>
                        <p className="text-xs text-muted-foreground">
                          Upgrade to {requiredTierName} to access this module
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
                {!isModulePlanLocked && !isTierLocked && !prereqsMet && (
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Lock className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">Complete Prerequisites First</p>
                        <p className="text-xs text-muted-foreground">
                          Complete the following modules to unlock:
                        </p>
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {incompletePrereqs.map((prereq) => (
                            <Badge key={prereq.id} variant="outline" className="text-xs">
                              Module {prereq.order_index}: {prereq.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
                {!isModulePlanLocked && !isTierLocked && prereqsMet && moduleTimeGated && (
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">Available Soon</p>
                        <p className="text-xs text-muted-foreground">
                          {moduleUnlockDate
                            ? `This module unlocks on ${format(moduleUnlockDate, "MMMM d, yyyy")}`
                            : "This module is not yet available"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tier Upgrade Dialog */}
      <TierUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentTier={enrollment?.tier || "essentials"}
        availableTiers={programTiers || []}
        onSubmit={handleTierUpgradeRequest}
        isSubmitting={isSubmittingUpgrade}
      />
    </TermsAcceptanceGate>
  );
}
