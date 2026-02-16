import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, TrendingUp, Award, Target, Brain, FileDown, Loader2 } from "lucide-react";
import { generateLearningTranscript } from "@/lib/pdfExport";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements } from "@/hooks/useEntitlements";
import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function LearningAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  if (!user) return null;
  const { hasFeature } = useEntitlements();
  const hasExternalCourses = hasFeature("external_courses");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [analytics, setAnalytics] = useState<any>({
    totalPrograms: 0,
    completedPrograms: 0,
    totalModules: 0,
    completedModules: 0,
    externalCourses: 0,
    completedExternalCourses: 0,
    skillsAcquired: [],
    recentActivity: [],
    completionRate: 0,
    averageProgress: 0,
    programs: [],
    externalCoursesData: [],
  });

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      // Fetch enrollments
      const { data: enrollments } = await supabase
        .from("client_enrollments")
        .select(
          `
          id,
          status,
          start_date,
          programs (
            id,
            name,
            category,
            program_skills (
              skills (
                id,
                name,
                category
              )
            )
          )
        `,
        )
        .eq("client_user_id", user.id);

      // Fetch module progress
      const { data: moduleProgress } = await supabase
        .from("module_progress")
        .select(
          `
          id,
          status,
          completed_at,
          program_modules (
            title,
            module_type,
            module_skills (
              skills (
                id,
                name,
                category
              )
            )
          )
        `,
        )
        .in("enrollment_id", enrollments?.map((e) => e.id) || []);

      // Fetch external courses
      const { data: externalCourses } = await supabase
        .from("external_courses")
        .select(
          `
          id,
          title,
          provider,
          status,
          planned_date,
          due_date,
          certificate_path,
          external_course_skills (
            skills (
              id,
              name,
              category
            )
          )
        `,
        )
        .eq("user_id", user.id);

      const totalPrograms = enrollments?.length || 0;
      const completedPrograms = enrollments?.filter((e) => e.status === "completed").length || 0;
      const totalModules = moduleProgress?.length || 0;
      const completedModules = moduleProgress?.filter((m) => m.status === "completed").length || 0;
      const totalExternalCourses = externalCourses?.length || 0;
      const completedExternalCourses =
        externalCourses?.filter((c) => c.status === "completed").length || 0;

      // Collect unique skills
      const skillsMap = new Map();

      // From completed modules
      moduleProgress
        ?.filter((m) => m.status === "completed")
        .forEach((m) => {
          m.program_modules?.module_skills?.forEach((ms) => {
            const skill = ms.skills;
            if (skill && !skillsMap.has(skill.id)) {
              skillsMap.set(skill.id, skill);
            }
          });
        });

      // From completed external courses
      externalCourses
        ?.filter((c) => c.status === "completed")
        .forEach((c) => {
          c.external_course_skills?.forEach((ecs) => {
            const skill = ecs.skills;
            if (skill && !skillsMap.has(skill.id)) {
              skillsMap.set(skill.id, skill);
            }
          });
        });

      const skillsAcquired = Array.from(skillsMap.values());

      // Calculate overall stats
      const enrollmentsWithProgress = await Promise.all(
        (enrollments || []).map(async (e) => {
          const modulesForProgram =
            moduleProgress?.filter((m) => enrollments?.find((en) => en.id === m.id)) || [];
          const totalModules = modulesForProgram.length;
          const completedModules = modulesForProgram.filter((m) => m.status === "completed").length;
          const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

          return {
            name: (e.programs as any).name,
            category: (e.programs as any).category,
            status: e.status,
            progress,
            completedModules,
            totalModules,
            start_date: e.start_date,
          };
        }),
      );

      const completionRate =
        totalPrograms > 0 ? Math.round((completedPrograms / totalPrograms) * 100) : 0;

      setAnalytics({
        totalPrograms,
        completedPrograms,
        totalModules,
        completedModules,
        externalCourses: totalExternalCourses,
        completedExternalCourses,
        skillsAcquired,
        completionRate,
        averageProgress: totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0,
        programs: enrollmentsWithProgress,
        externalCoursesData: externalCourses || [],
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTranscript = async () => {
    if (!user) return;

    setExporting(true);
    try {
      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const userName = profile?.name || "User";
      const userEmail = user.email || "";

      generateLearningTranscript(
        userName,
        userEmail,
        analytics.programs,
        analytics.externalCoursesData,
        analytics.skillsAcquired,
      );

      toast({
        title: "Transcript exported",
        description: "Your learning transcript has been downloaded as a PDF.",
      });
    } catch (error) {
      console.error("Error exporting transcript:", error);
      toast({
        title: "Export failed",
        description: "Failed to export learning transcript.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <PageLoadingState message="Loading analytics..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Learning Analytics</h1>
          <p className="text-muted-foreground">
            Track your learning progress and skill development
          </p>
        </div>
        <Button onClick={handleExportTranscript} disabled={exporting}>
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Export Transcript
            </>
          )}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Learning Items</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.totalPrograms + analytics.externalCourses}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalPrograms} programs, {analytics.externalCourses} external courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate}%</div>
            <Progress value={analytics.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills Acquired</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.skillsAcquired.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique skills from completed courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modules Completed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.completedModules}/{analytics.totalModules}
            </div>
            <Progress value={analytics.averageProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.completedPrograms}/{analytics.totalPrograms}
            </div>
            <p className="text-xs text-muted-foreground mt-1">InnoTrue programs</p>
          </CardContent>
        </Card>

        {hasExternalCourses && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">External Courses</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.completedExternalCourses}/{analytics.externalCourses}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Completed external courses</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Skills Breakdown */}
      {analytics.skillsAcquired.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills Acquired</CardTitle>
            <CardDescription>
              Skills you've gained through completed programs and courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analytics.skillsAcquired.map((skill: any) => (
                <Badge key={skill.id} variant="secondary" className="text-sm">
                  {skill.name}
                  {skill.category && (
                    <span className="ml-1 text-xs text-muted-foreground">• {skill.category}</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learning Progress Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Program Progress</CardTitle>
            <CardDescription>Your progress in InnoTrue programs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Active Programs</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.totalPrograms - analytics.completedPrograms}
                </span>
              </div>
              <Progress
                value={
                  analytics.totalPrograms > 0
                    ? ((analytics.totalPrograms - analytics.completedPrograms) /
                        analytics.totalPrograms) *
                      100
                    : 0
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Completed Programs</span>
                <span className="text-sm text-muted-foreground">{analytics.completedPrograms}</span>
              </div>
              <Progress value={analytics.completionRate} />
            </div>
          </CardContent>
        </Card>

        {hasExternalCourses && (
          <Card>
            <CardHeader>
              <CardTitle>External Learning</CardTitle>
              <CardDescription>Progress in external courses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">In Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {analytics.externalCourses - analytics.completedExternalCourses}
                  </span>
                </div>
                <Progress
                  value={
                    analytics.externalCourses > 0
                      ? ((analytics.externalCourses - analytics.completedExternalCourses) /
                          analytics.externalCourses) *
                        100
                      : 0
                  }
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Completed</span>
                  <span className="text-sm text-muted-foreground">
                    {analytics.completedExternalCourses}
                  </span>
                </div>
                <Progress
                  value={
                    analytics.externalCourses > 0
                      ? (analytics.completedExternalCourses / analytics.externalCourses) * 100
                      : 0
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
