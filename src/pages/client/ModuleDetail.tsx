import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Timer,
  Award,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  Lock,
  Paperclip,
  Plus,
  RotateCcw,
  PlayCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useTalentLmsSSO } from "@/hooks/useTalentLmsSSO";
import { useTalentLmsProgress } from "@/hooks/useTalentLmsProgress";
import { awardSkillsForModuleCompletion } from "@/hooks/useSkillsAcquisition";
import ModuleReflections from "@/components/modules/ModuleReflections";
import ModuleFeedback from "@/components/modules/ModuleFeedback";
import { ModuleAssignmentsView } from "@/components/modules/ModuleAssignmentsView";
import { ModuleSelfAssessment } from "@/components/modules/ModuleSelfAssessment";
import { ModuleSessionDisplay } from "@/components/modules/ModuleSessionDisplay";
import { ModuleScenariosSection } from "@/components/modules/ModuleScenariosSection";
import { AssignedScenarioItem } from "@/components/modules/AssignedScenarioItem";
import { ContentPackageViewer } from "@/components/modules/ContentPackageViewer";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ModuleSectionsDisplay } from "@/components/modules/ModuleSectionsDisplay";
import { ClientResourceList } from "@/components/resources/ClientResourceList";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { PlanLockOverlay } from "@/components/programs/PlanLockOverlay";
import { ModuleTeamContact } from "@/components/modules/ModuleTeamContact";
import { usePageView } from "@/hooks/useAnalytics";
import { SessionMismatchGuard } from "@/components/auth/SessionMismatchGuard";
import { useModuleSchedulingUrl } from "@/hooks/useModuleSchedulingUrl";
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
  content?: string;
  module_type: string;
  estimated_minutes: number;
  tier_required: string;
  is_individualized?: boolean;
  links?: ModuleLink[];
  program_id: string;
  order_index: number;
  calendly_event_url?: string;
  plan_id?: string | null;
  min_plan_tier?: number;
  content_package_path?: string | null;
  content_package_type?: "web" | "xapi" | null;
  content_package_id?: string | null;
  content_packages?: { package_type: string } | null;
  available_from_date?: string | null;
  unlock_after_days?: number | null;
  progress?: {
    id: string;
    status: string;
    notes: string | null;
    enrollment_id: string;
  };
}

interface PrerequisiteModule {
  id: string;
  title: string;
  order_index: number;
}

interface ClientContent {
  id: string;
  content: string;
  attachments?: {
    id: string;
    title: string;
    attachment_type: string;
    file_path?: string;
    url?: string;
    description?: string;
  }[];
  resources?: {
    id: string;
    resource: {
      id: string;
      title: string;
      description: string | null;
      resource_type: string;
      url: string | null;
      file_path: string | null;
    };
  }[];
  scenarios?: {
    id: string;
    scenario_template_id: string;
    scenario_templates: {
      id: string;
      title: string;
      description: string | null;
      is_protected: boolean;
      capability_assessments?: {
        id: string;
        name: string;
      } | null;
    } | null;
  }[];
}

export default function ModuleDetail() {
  const { programId, moduleId } = useParams();
  if (!programId || !moduleId) return null;
  const navigate = useNavigate();
  const { user } = useAuth();

  // Track page view for analytics
  usePageView("Module Detail");

  const [module, setModule] = useState<Module | null>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [programName, setProgramName] = useState<string>("Program");
  const [clientContent, setClientContent] = useState<ClientContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [modulePlanAccessGranted, setModulePlanAccessGranted] = useState<boolean | null>(null);
  const [incompletePrereqs, setIncompletePrereqs] = useState<PrerequisiteModule[]>([]);
  const { loginToTalentLms, isLoading: isSSOLoading } = useTalentLmsSSO();
  const { progress: talentLmsProgress } = useTalentLmsProgress(user?.id);
  const {
    checkModulePlanAccess,
    getPlanNameForTier,
    userPlan,
    isLoading: planAccessLoading,
  } = usePlanAccess();

  // Fetch the Cal.com scheduling URL based on module type and enrollment
  const { data: calcomSchedulingData } = useModuleSchedulingUrl({
    moduleType: module?.module_type || "",
    moduleId: moduleId || "",
    programId: programId || "",
    enrollmentId: enrollment?.id, // Pass enrollment for client-specific instructor resolution
    enabled: !!module?.module_type && !!moduleId && !!programId,
  });
  const calcomSchedulingUrl = calcomSchedulingData?.schedulingUrl;

  useEffect(() => {
    async function fetchData() {
      if (!user || !moduleId || !programId) return;

      // Fetch program name
      const { data: programData } = await supabase
        .from("programs")
        .select("name")
        .eq("id", programId)
        .single();

      if (programData) {
        setProgramName(programData.name);
      }

      const { data: enrollmentData } = await supabase
        .from("client_enrollments")
        .select("*")
        .eq("client_user_id", user.id)
        .eq("program_id", programId)
        .single();

      const { data: moduleData } = await supabase
        .from("program_modules")
        .select("*, plan_id, min_plan_tier, content_package_path, content_package_type, content_package_id, content_packages(package_type), available_from_date, unlock_after_days")
        .eq("id", moduleId)
        .single();

      // Check prerequisites
      if (moduleData && enrollmentData) {
        const { data: prereqsData } = await supabase
          .from("module_prerequisites")
          .select("prerequisite_module_id")
          .eq("module_id", moduleData.id);

        if (prereqsData && prereqsData.length > 0) {
          const prereqIds = prereqsData.map((p) => p.prerequisite_module_id);

          // Fetch progress for prerequisites
          const { data: prereqProgress } = await supabase
            .from("module_progress")
            .select("module_id, status")
            .eq("enrollment_id", enrollmentData.id)
            .in("module_id", prereqIds);

          const progressMap = new Map(
            (prereqProgress || []).map((p) => [p.module_id, p.status]),
          );

          // Find incomplete prerequisites
          const incompleteIds = prereqIds.filter(
            (id) => progressMap.get(id) !== "completed",
          );

          if (incompleteIds.length > 0) {
            const { data: prereqModules } = await supabase
              .from("program_modules")
              .select("id, title, order_index")
              .in("id", incompleteIds)
              .order("order_index");
            setIncompletePrereqs(prereqModules || []);
          } else {
            setIncompletePrereqs([]);
          }
        }
      }

      if (moduleData && enrollmentData) {
        let progressData = await supabase
          .from("module_progress")
          .select("*")
          .eq("enrollment_id", enrollmentData.id)
          .eq("module_id", moduleData.id)
          .maybeSingle();

        // Create progress record if it doesn't exist - set to in_progress when user opens module
        if (!progressData.data) {
          const { data: newProgress } = await supabase
            .from("module_progress")
            .insert({
              enrollment_id: enrollmentData.id,
              module_id: moduleData.id,
              status: "in_progress",
            })
            .select()
            .single();
          progressData.data = newProgress;
        } else if (progressData.data.status === "not_started") {
          // Upgrade from not_started to in_progress when viewing
          const { data: updatedProgress } = await supabase
            .from("module_progress")
            .update({ status: "in_progress" })
            .eq("id", progressData.data.id)
            .select()
            .single();
          if (updatedProgress) {
            progressData.data = updatedProgress;
          }
        }

        // Fetch client-specific content if module is individualized
        if (moduleData.is_individualized) {
          const { data: contentData } = await supabase
            .from("module_client_content")
            .select("*, module_client_content_attachments(*)")
            .eq("module_id", moduleData.id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (contentData) {
            // Fetch assigned resources
            const { data: resourcesData } = await supabase
              .from("module_client_content_resources")
              .select(
                `
                id,
                resource:resource_id(id, title, description, resource_type, url, file_path)
              `,
              )
              .eq("module_client_content_id", contentData.id);

            // Fetch assigned scenarios
            const { data: scenarioLinks, error: scenarioLinksError } = await supabase
              .from("module_client_content_scenarios")
              .select("id, scenario_template_id")
              .eq("module_client_content_id", contentData.id);

            if (scenarioLinksError) throw scenarioLinksError;

            const templateIds = (scenarioLinks || [])
              .map((s) => s.scenario_template_id)
              .filter(Boolean);

            let templatesById = new Map<
              string,
              {
                id: string;
                title: string;
                description: string | null;
                is_protected: boolean;
                capability_assessments?: { id: string; name: string } | null;
              }
            >();

            if (templateIds.length > 0) {
              const { data: templatesData, error: templatesError } = await supabase
                .from("scenario_templates")
                .select(
                  `
                  id,
                  title,
                  description,
                  is_protected,
                  capability_assessments (id, name)
                `,
                )
                .in("id", templateIds);

              if (templatesError) throw templatesError;

              templatesById = new Map((templatesData || []).map((t: any) => [t.id, t]));
            }

            const scenariosData = (scenarioLinks || []).map((link) => ({
              ...link,
              scenario_templates: templatesById.get(link.scenario_template_id) || null,
            }));

            setClientContent({
              id: contentData.id,
              content: contentData.content,
              attachments: (contentData as any).module_client_content_attachments || [],
              resources: (resourcesData as any) || [],
              scenarios: (scenariosData as any) || [],
            });
          }
        }

        setModule({
          ...moduleData,
          links: (moduleData.links as unknown as ModuleLink[]) || [],
          progress: progressData.data || undefined,
        } as Module);
        setNotes(progressData.data?.notes || "");
      }

      setEnrollment(enrollmentData);
      setLoading(false);
    }

    fetchData();
  }, [user, moduleId, programId]);

  // Get access token for content package iframe (iframes can't send Authorization headers)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, [user]);

  // Check module plan access
  useEffect(() => {
    if (planAccessLoading || !module || !programId) return;

    const checkAccess = async () => {
      const hasAccess = await checkModulePlanAccess(
        module.id,
        programId,
        module.plan_id || null,
        module.min_plan_tier || 0,
      );
      setModulePlanAccessGranted(hasAccess);
    };

    checkAccess();
  }, [planAccessLoading, module, programId, checkModulePlanAccess]);

  // ── CT3: Auto-accept completion from shared content package ──
  // If this module uses a shared content package and the user has already completed
  // that content via another module/program, auto-mark this module as completed.
  useEffect(() => {
    if (!module || !enrollment || !user) return;
    if (module.progress?.status === "completed") return; // Already completed
    const cpId = module.content_package_id;
    if (!cpId) return;

    (async () => {
      try {
        const { data: cc } = await supabase
          .from("content_completions")
          .select("id")
          .eq("user_id", user.id)
          .eq("content_package_id", cpId)
          .maybeSingle();

        if (!cc) return; // No cross-program completion found

        // Auto-upsert module_progress to completed
        const { error } = await supabase.from("module_progress").upsert(
          {
            enrollment_id: enrollment.id,
            module_id: module.id,
            status: "completed",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "enrollment_id,module_id" },
        );

        if (!error) {
          // Update local state without full page reload
          setModule((prev) =>
            prev
              ? {
                  ...prev,
                  progress: prev.progress
                    ? { ...prev.progress, status: "completed" }
                    : prev.progress,
                }
              : prev,
          );
          toast.success("Auto-completed! You already finished this content in another program.", {
            duration: 5000,
          });
        }
      } catch (err) {
        console.error("CT3 auto-accept check failed:", err);
      }
    })();
  }, [module?.id, module?.content_package_id, module?.progress?.status, enrollment?.id, user?.id]);

  async function toggleModuleStatus() {
    if (!enrollment || !module || !user) return;

    const currentStatus = module.progress?.status || "not_started";
    const newStatus = currentStatus === "completed" ? "not_started" : "completed";

    const { data, error } = await supabase
      .from("module_progress")
      .upsert(
        {
          enrollment_id: enrollment.id,
          module_id: module.id,
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        },
        { onConflict: "enrollment_id,module_id" },
      )
      .select("id")
      .single();

    if (error) {
      toast.error("Failed to update progress");
    } else {
      // Award skills on module completion
      if (newStatus === "completed" && data?.id) {
        const { awarded } = await awardSkillsForModuleCompletion(user.id, module.id, data.id);
        if (awarded > 0) {
          toast.success(`Completed! ${awarded} skill${awarded > 1 ? "s" : ""} acquired.`);
        } else {
          toast.success("Progress updated!");
        }
      } else {
        toast.success("Progress updated!");
      }
      window.location.reload();
    }
  }

  // Check if module is linked to TalentLMS
  const isTalentLmsLinked = (): boolean => {
    return module?.links?.some((link) => link.type === "talentlms") || false;
  };

  async function resetModuleProgress() {
    if (!enrollment || !module || !user) return;

    // Don't allow reset for TalentLMS-linked modules
    if (isTalentLmsLinked()) {
      toast.error("Cannot reset progress for InnoTrue Academy modules");
      return;
    }

    const { error } = await supabase.from("module_progress").upsert(
      {
        enrollment_id: enrollment.id,
        module_id: module.id,
        status: "not_started",
        completed_at: null,
      },
      { onConflict: "enrollment_id,module_id" },
    );

    if (error) {
      toast.error("Failed to reset progress");
    } else {
      toast.success("Progress reset!");
      window.location.reload();
    }
  }

  async function saveNotes() {
    if (!enrollment || !module || !module.progress?.id) return;

    const { error } = await supabase
      .from("module_progress")
      .update({ notes })
      .eq("id", module.progress.id);

    if (error) {
      toast.error("Failed to save notes");
    } else {
      setModule({
        ...module,
        progress: { ...module.progress, notes },
      });
      toast.success("Notes saved!");
      setEditingNotes(false);
    }
  }

  const handleLinkClick = (link: ModuleLink) => {
    if (link.type === "talentlms") {
      // Extract path from full TalentLMS URL for SSO redirect
      // e.g., https://academy.innotrue.com/plus/courses/341 -> /plus/courses/341
      let redirectPath = link.url;
      try {
        const parsed = new URL(link.url);
        redirectPath = parsed.pathname;
      } catch {
        // If not a valid URL, use as-is
      }
      loginToTalentLms(redirectPath);
    } else {
      window.open(link.url, "_blank");
    }
  };

  const getTalentLmsCourseId = (): string | null => {
    const talentLmsLink = module?.links?.find((link) => link.type === "talentlms");
    if (!talentLmsLink) return null;
    // Extract course ID from URL like https://academy.innotrue.com/plus/courses/341
    const match = talentLmsLink.url.match(/\/courses\/(\d+)/);
    return match ? match[1] : null;
  };

  const getModuleTalentLmsProgress = () => {
    const courseId = getTalentLmsCourseId();
    if (!courseId) return null;
    return talentLmsProgress.find((p) => p.talentlms_course_id === courseId);
  };

  if (loading)
    return (
      <SessionMismatchGuard>
        <PageLoadingState message="Loading module..." />
      </SessionMismatchGuard>
    );
  if (!module)
    return (
      <SessionMismatchGuard>
        <ErrorState title="Not Found" description="The requested module could not be found." />
      </SessionMismatchGuard>
    );

  const isLocked = module.tier_required === "premium" && enrollment?.tier !== "premium";
  const isModulePlanLocked = !planAccessLoading && modulePlanAccessGranted === false;
  const requiredPlanName = module.min_plan_tier ? getPlanNameForTier(module.min_plan_tier) : "";

  // Check prerequisite lock
  const isPrerequisiteLocked = incompletePrereqs.length > 0;

  // Check time-gate lock
  const now = new Date();
  let isTimeGateLocked = false;
  let unlockDate: Date | null = null;

  if (module.available_from_date) {
    const d = new Date(module.available_from_date);
    if (now < d) {
      isTimeGateLocked = true;
      unlockDate = d;
    }
  }
  if (module.unlock_after_days != null && module.unlock_after_days > 0 && enrollment?.created_at) {
    const enrollmentDate = new Date(enrollment.created_at);
    const d = new Date(enrollmentDate);
    d.setDate(d.getDate() + module.unlock_after_days);
    if (now < d) {
      isTimeGateLocked = true;
      if (!unlockDate || d > unlockDate) unlockDate = d;
    }
  }

  // Common breadcrumb for lock overlays
  const lockBreadcrumb = (
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
          <BreadcrumbLink
            onClick={() => navigate(`/programs/${programId}`)}
            className="cursor-pointer"
          >
            {programName}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>{module.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  // Show plan lock overlay if module is locked by plan
  if (isModulePlanLocked) {
    return (
      <SessionMismatchGuard>
        <div className="space-y-6">
          {lockBreadcrumb}
          <Card>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <RichTextDisplay content={module.description} className="text-muted-foreground" />
            </CardHeader>
          </Card>
          <PlanLockOverlay
            reason="plan_required"
            requiredPlanName={requiredPlanName}
            userPlanName={userPlan?.name}
          />
        </div>
      </SessionMismatchGuard>
    );
  }

  // Show prerequisite lock overlay
  if (isPrerequisiteLocked) {
    return (
      <SessionMismatchGuard>
        <div className="space-y-6">
          {lockBreadcrumb}
          <Card>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <RichTextDisplay content={module.description} className="text-muted-foreground" />
            </CardHeader>
          </Card>
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <Lock className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">Complete Prerequisites First</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You need to complete the following modules before accessing this one:
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {incompletePrereqs.map((prereq) => (
                    <Badge key={prereq.id} variant="outline" className="text-sm">
                      Module {prereq.order_index}: {prereq.title}
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/programs/${programId}`)}
                  className="mt-2"
                >
                  Back to Program
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SessionMismatchGuard>
    );
  }

  // Show time-gate lock overlay
  if (isTimeGateLocked) {
    return (
      <SessionMismatchGuard>
        <div className="space-y-6">
          {lockBreadcrumb}
          <Card>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <RichTextDisplay content={module.description} className="text-muted-foreground" />
            </CardHeader>
          </Card>
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <Clock className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">Available Soon</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {unlockDate
                      ? `This module will be available on ${format(unlockDate, "MMMM d, yyyy")}.`
                      : "This module is not yet available."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/programs/${programId}`)}
                  className="mt-2"
                >
                  Back to Program
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SessionMismatchGuard>
    );
  }

  return (
    <SessionMismatchGuard>
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
              <BreadcrumbLink
                onClick={() => navigate(`/programs/${programId}`)}
                className="cursor-pointer"
              >
                {programName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{module.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Module {module.order_index + 1}</span>
            <Badge variant="outline">{module.module_type}</Badge>
            {module.progress?.status === "completed" ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Completed
              </Badge>
            ) : module.progress?.status === "in_progress" ? (
              <Badge variant="secondary" className="gap-1">
                <PlayCircle className="h-3 w-3" />
                In Progress
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Circle className="h-3 w-3" />
                Not Started
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{module.title}</h1>
          {!isLocked && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={toggleModuleStatus}
                variant={module.progress?.status === "completed" ? "outline" : "default"}
                size="sm"
              >
                {module.progress?.status === "completed"
                  ? "Mark as Incomplete"
                  : "Mark as Complete"}
              </Button>

              {/* Reset progress button - disabled for TalentLMS modules */}
              {module.progress?.status !== "not_started" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          onClick={resetModuleProgress}
                          variant="ghost"
                          size="sm"
                          disabled={isTalentLmsLinked()}
                          className="text-muted-foreground"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset Progress
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {isTalentLmsLinked() && (
                      <TooltipContent>
                        <p>Progress is auto-synced from InnoTrue Academy for this module</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Module Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RichTextDisplay content={module.description} className="text-muted-foreground" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{module.estimated_minutes} minutes</span>
            </div>
            <ModuleTeamContact moduleId={module.id} programId={programId!} enrollmentId={enrollment?.id} />
          </CardContent>
        </Card>

        {!isLocked && module.progress?.id && enrollment?.id && (
          <ModuleSessionDisplay
            moduleId={module.id}
            enrollmentId={enrollment.id}
            programId={programId}
            schedulingUrl={calcomSchedulingUrl || undefined}
            moduleName={module.title}
            defaultDuration={module.estimated_minutes}
            moduleType={module.module_type}
          />
        )}

        {/* Legacy single content field */}
        {!isLocked && module.content && (
          <Card>
            <CardHeader>
              <CardTitle>Module Content</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextDisplay content={module.content} />
            </CardContent>
          </Card>
        )}

        {/* New module sections */}
        {!isLocked && <ModuleSectionsDisplay moduleId={module.id} />}

        {/* Embedded content package (Rise/web export) — shown for legacy path OR shared content_package_id */}
        {!isLocked && (module.content_package_path || module.content_package_id) && accessToken && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                InnoTrue Academy Learning Module
              </CardTitle>
              <CardDescription>
                Complete this interactive learning module at your own pace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentPackageViewer
                moduleId={module.id}
                accessToken={accessToken}
                title={module.title}
                contentPackageType={
                  (module.content_package_id && module.content_packages?.package_type === "xapi")
                    || module.content_package_type === "xapi"
                    ? "xapi" : "web"
                }
                onXapiComplete={() => {
                  // Update local state to reflect auto-completed progress
                  // without reloading the page (which would destroy the iframe).
                  setModule((prev) =>
                    prev
                      ? {
                          ...prev,
                          progress: prev.progress
                            ? { ...prev.progress, status: "completed" }
                            : prev.progress,
                        }
                      : prev,
                  );
                  toast.success("Module completed! 🎉");
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Client-specific content for individualized modules */}
        {!isLocked && clientContent && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Assignment
              </CardTitle>
              <CardDescription>This content has been specifically assigned to you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="whitespace-pre-wrap">{clientContent.content}</div>

              {clientContent.attachments && clientContent.attachments.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Attached Files & Links</p>
                  <div className="flex flex-wrap gap-2">
                    {clientContent.attachments.map((att) => (
                      <Button
                        key={att.id}
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (att.url) {
                            window.open(att.url, "_blank");
                          } else if (att.file_path) {
                            const { data } = await supabase.storage
                              .from("module-client-content")
                              .createSignedUrl(att.file_path, 3600);
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, "_blank");
                            }
                          }
                        }}
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        {att.title}
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {clientContent.resources && clientContent.resources.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Assigned Resources</p>
                  <div className="flex flex-wrap gap-2">
                    {clientContent.resources.map((res) => (
                      <Button
                        key={res.id}
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (res.resource.url) {
                            window.open(res.resource.url, "_blank");
                          } else if (res.resource.file_path) {
                            const { data } = await supabase.storage
                              .from("resource-library")
                              .createSignedUrl(res.resource.file_path, 3600);
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, "_blank");
                            }
                          }
                        }}
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        {res.resource.title}
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {clientContent.scenarios && clientContent.scenarios.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Assigned Scenarios</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Complete these scenarios as part of your assignment. Click to start.
                  </p>
                  <div className="space-y-2">
                    {clientContent.scenarios.map((scen) => (
                      <AssignedScenarioItem
                        key={scen.id}
                        scenarioTemplateId={scen.scenario_template_id}
                        title={scen.scenario_templates?.title || "Untitled Scenario"}
                        assessmentName={scen.scenario_templates?.capability_assessments?.name}
                        moduleId={moduleId!}
                        enrollmentId={enrollment?.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isLocked && module.links && module.links.length > 0 && (
          <Card
            className={module.module_type === "content" ? "border-primary/50 bg-primary/5" : ""}
          >
            <CardHeader>
              <CardTitle
                className={module.module_type === "content" ? "flex items-center gap-2" : ""}
              >
                {module.module_type === "content" && <Award className="h-5 w-5 text-primary" />}
                {module.module_type === "content"
                  ? "InnoTrue Academy Learning Module"
                  : "External Links"}
              </CardTitle>
              {module.module_type === "content" && (
                <CardDescription>
                  Access your self-paced learning content on InnoTrue Academy
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                {module.links.map((link, index) => (
                  <Button
                    key={index}
                    onClick={() => handleLinkClick(link)}
                    variant={
                      module.module_type === "content" && link.type === "talentlms"
                        ? "default"
                        : "outline"
                    }
                    disabled={link.type === "talentlms" && isSSOLoading}
                    className="justify-start text-left w-full sm:w-auto"
                  >
                    <span className="truncate">{link.name}</span>
                    <ExternalLink className="ml-2 h-3 w-3 shrink-0" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLocked && (
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientResourceList moduleId={moduleId!} programId={programId} />
            </CardContent>
          </Card>
        )}

        {!isLocked && getTalentLmsCourseId() && getModuleTalentLmsProgress() && (
          <Card>
            <CardHeader>
              <CardTitle>TalentLMS Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const tlmsProgress = getModuleTalentLmsProgress()!;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Completion Status</span>
                      <Badge
                        variant={
                          tlmsProgress.completion_status === "completed"
                            ? "default"
                            : tlmsProgress.completion_status === "in_progress"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {tlmsProgress.completion_status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{tlmsProgress.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${tlmsProgress.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                    {tlmsProgress.time_spent_minutes > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Time Spent
                        </span>
                        <span className="font-medium">
                          {Math.floor(tlmsProgress.time_spent_minutes / 60)}h{" "}
                          {tlmsProgress.time_spent_minutes % 60}m
                        </span>
                      </div>
                    )}
                    {tlmsProgress.test_score !== null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          Test Score
                        </span>
                        <span className="font-medium">{tlmsProgress.test_score}%</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {!isLocked && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    My Notes
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Keep track of your thoughts and key takeaways
                  </CardDescription>
                </div>
                {!editingNotes && (
                  <Button
                    onClick={() => setEditingNotes(true)}
                    size="sm"
                    className="shrink-0 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {module.progress?.notes ? "Edit" : "Add Note"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingNotes ? (
                <div className="space-y-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your notes..."
                    rows={5}
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveNotes}>Save</Button>
                    <Button onClick={() => setEditingNotes(false)} variant="outline">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {module.progress?.notes ? (
                    <p
                      className="whitespace-pre-wrap cursor-pointer hover:bg-accent/50 p-2 -m-2 rounded-md transition-colors"
                      onClick={() => setEditingNotes(true)}
                      title="Click to edit notes"
                    >
                      {module.progress.notes}
                    </p>
                  ) : (
                    <p className="text-muted-foreground py-4 text-center">
                      No notes yet. Add your first note to track your learning journey.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isLocked && module.progress?.id && enrollment?.id && (
          <>
            <Separator />
            <ModuleScenariosSection moduleId={module.id} enrollmentId={enrollment.id} />
            <ModuleSelfAssessment moduleId={module.id} enrollmentId={enrollment.id} />
            <ModuleAssignmentsView
              moduleId={module.id}
              moduleProgressId={module.progress.id}
              isEditable={true}
            />
            <ModuleReflections moduleProgressId={module.progress.id} />
            <ModuleFeedback moduleProgressId={module.progress.id} />
          </>
        )}
      </div>
    </SessionMismatchGuard>
  );
}
