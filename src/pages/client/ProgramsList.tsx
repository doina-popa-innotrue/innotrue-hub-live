import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Activity as ActivityIcon, CalendarDays, ArrowRight } from "lucide-react";
import { hasTierAccess } from "@/lib/tierUtils";
import { usePageView } from "@/hooks/useAnalytics";

interface EnrollmentSummary {
  id: string;
  programId: string;
  status: string;
  programName: string;
  programCategory: string;
  progress: number;
  completedModules: number;
  totalModules: number;
}

interface ExternalCourse {
  id: string;
  title: string;
  provider: string;
  status: string;
  planned_date?: string | null;
  due_date?: string | null;
  certificate_path?: string | null;
  updated_at?: string | null;
}

interface ActivityItem {
  id: string;
  type: "module" | "external";
  title: string;
  subtitle: string;
  completedAt: string;
}

export default function ClientProgramsList() {
  // Track page view for analytics
  usePageView("Programs");

  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentSummary[]>([]);
  const [externalCourses, setExternalCourses] = useState<ExternalCourse[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Fetch client enrollments with program info and tier
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from("client_enrollments")
          .select(
            `id, status, start_date, program_id, tier, programs ( id, name, category, tiers )`,
          )
          .eq("client_user_id", user.id)
          .order("created_at", { ascending: true });

        if (enrollmentsError) {
          console.error("Error loading enrollments:", enrollmentsError);
          setLoading(false);
          return;
        }

        const enrollmentIds = (enrollmentsData || []).map((e: any) => e.id);

        // Fetch all program modules with tier info
        const programIds = [...new Set((enrollmentsData || []).map((e: any) => e.program_id))];
        let allModules: any[] = [];
        if (programIds.length > 0) {
          const { data: modulesData } = await supabase
            .from("program_modules")
            .select("id, program_id, tier_required, title, module_type")
            .in("program_id", programIds);
          allModules = modulesData || [];
        }

        // Fetch module progress for these enrollments
        let moduleProgress: any[] = [];
        if (enrollmentIds.length > 0) {
          const { data: moduleProgressData, error: moduleError } = await supabase
            .from("module_progress")
            .select(
              `id, enrollment_id, status, completed_at, module_id, program_modules ( title, module_type )`,
            )
            .in("enrollment_id", enrollmentIds);

          if (moduleError) {
            console.error("Error loading module progress:", moduleError);
          } else {
            moduleProgress = moduleProgressData || [];
          }
        }

        // Fetch external courses
        const { data: externalCoursesData, error: externalError } = await supabase
          .from("external_courses")
          .select(
            "id, title, provider, status, planned_date, due_date, certificate_path, updated_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (externalError) {
          console.error("Error loading external courses:", externalError);
        }

        // Build enrollment summaries with tier-based accessible modules
        const enrollmentSummaries: EnrollmentSummary[] = (enrollmentsData || []).map((e: any) => {
          const programTiers = (e.programs?.tiers as string[]) || [];
          const userTier = e.tier || programTiers[0] || "essentials";

          // Get all modules for this program
          const programModules = allModules.filter((m) => m.program_id === e.program_id);

          // Filter to accessible modules based on user's tier
          const accessibleModules = programModules.filter((m) =>
            hasTierAccess(programTiers, userTier, m.tier_required),
          );

          const accessibleModuleIds = new Set(accessibleModules.map((m) => m.id));

          // Filter progress to only accessible modules
          const accessibleProgress = moduleProgress.filter(
            (m) => m.enrollment_id === e.id && accessibleModuleIds.has(m.module_id),
          );

          const totalModules = accessibleModules.length;
          const completedModules = accessibleProgress.filter(
            (m) => m.status === "completed",
          ).length;
          const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

          return {
            id: e.id,
            programId: e.program_id,
            status: e.status,
            programName: e.programs?.name || "Program",
            programCategory: e.programs?.category || "other",
            progress,
            completedModules,
            totalModules,
          };
        });

        setEnrollments(enrollmentSummaries);
        setExternalCourses((externalCoursesData as ExternalCourse[]) || []);

        // Build recent activity feed (modules + external completions)
        const moduleActivities: ActivityItem[] = moduleProgress
          .filter((m) => m.status === "completed" && m.completed_at)
          .map((m) => {
            const enrollment = (enrollmentsData || []).find((e: any) => e.id === m.enrollment_id);
            return {
              id: `module-${m.id}`,
              type: "module",
              title: m.program_modules?.title || "Module completed",
              subtitle: enrollment?.programs?.name || "Program module",
              completedAt: m.completed_at as string,
            };
          });

        const externalActivities: ActivityItem[] = (externalCoursesData || [])
          .filter((c: any) => c.status === "completed")
          .map((c: any) => ({
            id: `external-${c.id}`,
            type: "external",
            title: c.title,
            subtitle: c.provider,
            completedAt: c.updated_at || c.due_date || c.planned_date || new Date().toISOString(),
          }));

        const combined = [...moduleActivities, ...externalActivities].sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
        );

        setRecentActivity(combined.slice(0, 5));
      } catch (error) {
        console.error("Error loading programs page:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const totalPrograms = enrollments.length;
  const completedPrograms = enrollments.filter((e) => e.status === "completed").length;
  const activePrograms = enrollments.filter((e) => e.status !== "completed").length;

  const overallProgress =
    totalPrograms > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / totalPrograms)
      : 0;

  if (loading) {
    return <PageLoadingState message="Loading your programs..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Programs</h1>
          <p className="text-muted-foreground">
            Track your progress across all assigned programs and external learning.
          </p>
        </div>
        <Button onClick={() => navigate("/programs/explore")}>
          Explore more programs
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePrograms}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedPrograms} completed out of {totalPrograms} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Completion</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <Progress value={overallProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">External Courses</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{externalCourses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {externalCourses.filter((c) => c.status === "completed").length} completed
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* First row: Programs list and Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-[2fr,1.3fr]">
          <Card>
            <CardHeader>
              <CardTitle>Your Programs</CardTitle>
              <CardDescription>
                View progress and completion status across all assigned programs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {enrollments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  You are not currently enrolled in any programs. Use the
                  <button
                    className="font-medium underline underline-offset-2 ml-1"
                    onClick={() => navigate("/programs/explore")}
                  >
                    Explore Programs
                  </button>{" "}
                  page to discover available options.
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="rounded-lg border bg-card p-4 hover:bg-accent/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/programs/${enrollment.programId}`)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="font-medium">{enrollment.programName}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {enrollment.programCategory}
                            </Badge>
                            <span>
                              {enrollment.completedModules} of {enrollment.totalModules} modules
                              completed
                            </span>
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {Math.round(enrollment.progress)}%
                        </div>
                      </div>
                      <Progress value={enrollment.progress} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Last few modules and external courses you've completed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent activity yet. As you complete modules and courses, they'll appear here.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {recentActivity.map((item) => {
                    const isExternal = item.type === "external";
                    return (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2 hover:bg-accent/40 transition-colors cursor-pointer"
                        onClick={() => {
                          if (isExternal) {
                            navigate("/learning/external-courses");
                          } else {
                            // Extract module ID from item.id format "module-{id}"
                            const moduleId = item.id.replace("module-", "");
                            // Find enrollment to get program ID
                            const enrollment = enrollments.find(
                              (e) => e.programName === item.subtitle,
                            );
                            if (enrollment) {
                              navigate(`/programs/${enrollment.programId}`);
                            }
                          }
                        }}
                      >
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(item.completedAt).toLocaleDateString()}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second row: External Learning full width */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle>External Learning</CardTitle>
              <CardDescription>Courses you're tracking from other platforms.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/learning/external-courses")}
            >
              Manage
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {externalCourses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  You haven't added any external courses yet.
                </p>
                <Button size="sm" onClick={() => navigate("/learning/external-courses")}>
                  Add External Course
                </Button>
              </div>
            ) : (
              <ul className="space-y-3 text-sm">
                {externalCourses.slice(0, 3).map((course) => (
                  <li
                    key={course.id}
                    className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => navigate("/learning/external-courses")}
                  >
                    <div>
                      <div className="font-medium">{course.title}</div>
                      <div className="text-xs text-muted-foreground">{course.provider}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {course.status}
                      </Badge>
                      {course.due_date && (
                        <span className="text-[11px] text-muted-foreground">
                          Due {new Date(course.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {externalCourses.length > 3 && (
                  <li className="text-center">
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => navigate("/learning/external-courses")}
                    >
                      View all {externalCourses.length} courses
                    </Button>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
