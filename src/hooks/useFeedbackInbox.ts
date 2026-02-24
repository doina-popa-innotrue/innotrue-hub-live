import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type FeedbackType = "scenario" | "module" | "assignment" | "goal";

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  summary: string;
  givenBy: string;
  givenAt: string;
  linkTo: string;
  contextLabel: string;
}

function truncate(text: string | null | undefined, maxLen = 150): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

async function fetchScenarioFeedback(userId: string): Promise<FeedbackItem[]> {
  // Get scenario assignments that have been evaluated
  const { data: assignments, error } = await supabase
    .from("scenario_assignments")
    .select(`
      id,
      overall_notes,
      evaluated_at,
      evaluated_by,
      scenario_templates (title)
    `)
    .eq("user_id", userId)
    .eq("status", "evaluated")
    .not("evaluated_at", "is", null)
    .order("evaluated_at", { ascending: false });

  if (error || !assignments) return [];

  // Get evaluator names
  const evaluatorIds = [...new Set(assignments.map((a) => a.evaluated_by).filter(Boolean))] as string[];
  const profileMap = new Map<string, string>();
  if (evaluatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", evaluatorIds);
    profiles?.forEach((p) => profileMap.set(p.id, p.name || "Instructor"));
  }

  return assignments
    .filter((a) => a.overall_notes || a.evaluated_at)
    .map((a) => ({
      id: `scenario-${a.id}`,
      type: "scenario" as const,
      title: (a.scenario_templates as any)?.title || "Scenario Evaluation",
      summary: truncate(a.overall_notes || "Scenario has been evaluated"),
      givenBy: a.evaluated_by ? (profileMap.get(a.evaluated_by) || "Instructor") : "Instructor",
      givenAt: a.evaluated_at || "",
      linkTo: `/scenarios/${a.id}`,
      contextLabel: "Scenario Evaluation",
    }));
}

async function fetchModuleFeedback(userId: string): Promise<FeedbackItem[]> {
  // RLS ensures only the client's own module feedback is returned
  // Join through module_progress → client_enrollments to filter by user
  const { data, error } = await supabase
    .from("coach_module_feedback")
    .select(`
      id,
      feedback,
      created_at,
      coach_id,
      status,
      module_progress (
        module_id,
        enrollment_id,
        program_modules (title),
        client_enrollments (client_user_id)
      )
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Filter to only this user's feedback (belt-and-suspenders with RLS)
  const userFeedback = data.filter((f) => {
    const enrollment = (f.module_progress as any)?.client_enrollments;
    return enrollment?.client_user_id === userId;
  });

  // Get coach names
  const coachIds = [...new Set(userFeedback.map((f) => f.coach_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, string>();
  if (coachIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", coachIds);
    profiles?.forEach((p) => profileMap.set(p.id, p.name || "Coach"));
  }

  return userFeedback.map((f) => ({
    id: `module-${f.id}`,
    type: "module" as const,
    title: (f.module_progress as any)?.program_modules?.title || "Module Feedback",
    summary: truncate(f.feedback || "Feedback received"),
    givenBy: f.coach_id ? (profileMap.get(f.coach_id) || "Coach") : "Coach",
    givenAt: f.created_at || "",
    linkTo: "/assignments", // Module feedback is viewed through assignments/programs
    contextLabel: "Coach Feedback",
  }));
}

async function fetchAssignmentFeedback(userId: string): Promise<FeedbackItem[]> {
  // Get reviewed assignments with instructor notes
  // RLS restricts to user's own assignments
  const { data, error } = await supabase
    .from("module_assignments")
    .select(`
      id,
      instructor_notes,
      overall_score,
      scored_at,
      scored_by,
      module_progress (
        module_id,
        enrollment_id,
        program_modules (title),
        client_enrollments (client_user_id)
      )
    `)
    .eq("status", "reviewed")
    .not("scored_at", "is", null)
    .order("scored_at", { ascending: false });

  if (error || !data) return [];

  // Filter to this user's assignments
  const userAssignments = data.filter((a) => {
    const enrollment = (a.module_progress as any)?.client_enrollments;
    return enrollment?.client_user_id === userId;
  });

  // Get scorer names
  const scorerIds = [...new Set(userAssignments.map((a) => a.scored_by).filter(Boolean))] as string[];
  const profileMap = new Map<string, string>();
  if (scorerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", scorerIds);
    profiles?.forEach((p) => profileMap.set(p.id, p.name || "Instructor"));
  }

  return userAssignments
    .filter((a) => a.instructor_notes)
    .map((a) => {
      const scoreText = a.overall_score != null ? ` (Score: ${a.overall_score})` : "";
      return {
        id: `assignment-${a.id}`,
        type: "assignment" as const,
        title: (a.module_progress as any)?.program_modules?.title || "Assignment",
        summary: truncate(`${a.instructor_notes}${scoreText}`),
        givenBy: a.scored_by ? (profileMap.get(a.scored_by) || "Instructor") : "Instructor",
        givenAt: a.scored_at || "",
        linkTo: "/assignments",
        contextLabel: "Assignment Grading",
      };
    });
}

async function fetchGoalComments(userId: string): Promise<FeedbackItem[]> {
  // Get comments on user's goals from other users (coaches/instructors)
  const { data, error } = await supabase
    .from("goal_comments")
    .select(`
      id,
      comment,
      created_at,
      user_id,
      goal_id,
      goals (title, user_id)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Only include comments on the user's own goals, from OTHER users
  const relevantComments = data.filter((c) => {
    const goalOwner = (c.goals as any)?.user_id;
    return goalOwner === userId && c.user_id !== userId;
  });

  // Get commenter names
  const commenterIds = [...new Set(relevantComments.map((c) => c.user_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, string>();
  if (commenterIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", commenterIds);
    profiles?.forEach((p) => profileMap.set(p.id, p.name || "Coach"));
  }

  return relevantComments.map((c) => ({
    id: `goal-${c.id}`,
    type: "goal" as const,
    title: (c.goals as any)?.title || "Goal",
    summary: truncate(c.comment),
    givenBy: c.user_id ? (profileMap.get(c.user_id) || "Coach") : "Coach",
    givenAt: c.created_at || "",
    linkTo: `/goals/${c.goal_id}`,
    contextLabel: "Goal Comment",
  }));
}

export function useFeedbackInbox(limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["feedback-inbox", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const [scenarios, modules, assignments, goals] = await Promise.all([
        fetchScenarioFeedback(user.id),
        fetchModuleFeedback(user.id),
        fetchAssignmentFeedback(user.id),
        fetchGoalComments(user.id),
      ]);

      const allItems = [...scenarios, ...modules, ...assignments, ...goals];

      // Sort by date, newest first
      allItems.sort((a, b) => {
        const dateA = a.givenAt ? new Date(a.givenAt).getTime() : 0;
        const dateB = b.givenAt ? new Date(b.givenAt).getTime() : 0;
        return dateB - dateA;
      });

      return limit ? allItems.slice(0, limit) : allItems;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
