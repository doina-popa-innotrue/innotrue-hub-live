/**
 * DP4: Shared guided path instantiation service.
 *
 * Extracts the copy-to-goals pattern from GuidedPathDetail into a
 * reusable function that both the survey wizard and the manual copy
 * dialog can call.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";

// --------------- Types ---------------

interface TemplateTask {
  id: string;
  title: string;
  description: string | null;
  importance: boolean;
  urgency: boolean;
  order_index: number;
}

interface TemplateMilestone {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  recommended_days_min: number | null;
  recommended_days_optimal: number | null;
  recommended_days_max: number | null;
  guided_path_template_tasks: TemplateTask[];
}

interface TemplateGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  timeframe_type: string;
  priority: string;
  order_index: number;
  guided_path_template_milestones: TemplateMilestone[];
}

type GoalCategory =
  | "family_home"
  | "financial_career"
  | "mental_educational"
  | "spiritual_ethical"
  | "social_cultural"
  | "physical_health"
  | "health_fitness"
  | "career_business"
  | "finances"
  | "relationships"
  | "personal_growth"
  | "fun_recreation"
  | "physical_environment"
  | "family_friends"
  | "romance"
  | "contribution";

/** Maps legacy timeframe_type values (from templates) to goal_timeframe enum values */
function normalizeTimeframe(value: string): string {
  const map: Record<string, string> = {
    short_term: "short",
    medium_term: "medium",
    long_term: "long",
  };
  return map[value] || value;
}

const VALID_GOAL_CATEGORIES: GoalCategory[] = [
  "family_home",
  "financial_career",
  "mental_educational",
  "spiritual_ethical",
  "social_cultural",
  "physical_health",
  "health_fitness",
  "career_business",
  "finances",
  "relationships",
  "personal_growth",
  "fun_recreation",
  "physical_environment",
  "family_friends",
  "romance",
  "contribution",
];

const DEFAULT_MILESTONE_DAYS = 14;

export type PaceType = "min" | "optimal" | "max";

export interface InstantiationOptions {
  userId: string;
  templateId: string;
  surveyResponseId?: string;
  startDate: Date;
  paceType: PaceType;
}

export interface InstantiationResult {
  instantiationId: string;
  goalsCreated: number;
  milestonesCreated: number;
  tasksCreated: number;
  estimatedCompletionDate: Date;
}

// --------------- Helpers ---------------

function getQuadrant(importance: boolean, urgency: boolean) {
  if (importance && urgency) return "important_urgent";
  if (importance && !urgency) return "important_not_urgent";
  if (!importance && urgency) return "not_important_urgent";
  return "not_important_not_urgent";
}

function getDaysForMilestone(
  milestone: TemplateMilestone,
  paceType: PaceType,
): number {
  if (paceType === "min" && milestone.recommended_days_min) {
    return milestone.recommended_days_min;
  }
  if (paceType === "optimal" && milestone.recommended_days_optimal) {
    return milestone.recommended_days_optimal;
  }
  if (paceType === "max" && milestone.recommended_days_max) {
    return milestone.recommended_days_max;
  }
  // Fallback priority: optimal > max > min > default
  return (
    milestone.recommended_days_optimal ||
    milestone.recommended_days_max ||
    milestone.recommended_days_min ||
    DEFAULT_MILESTONE_DAYS
  );
}

// --------------- Main function ---------------

/**
 * Instantiate a guided path template into goals, milestones, and tasks.
 *
 * 1. Creates a `guided_path_instantiations` record
 * 2. Fetches the full template (goals → milestones → tasks)
 * 3. Creates goals with `template_goal_id` + `instantiation_id`
 * 4. Creates milestones with pace-adjusted due dates
 * 5. Creates tasks per milestone
 * 6. Returns summary counts + estimated completion date
 */
export async function instantiateTemplate(
  supabase: SupabaseClient,
  options: InstantiationOptions,
): Promise<InstantiationResult> {
  const { userId, templateId, surveyResponseId, startDate, paceType } = options;

  // Map pace type to multiplier for the instantiation record
  const paceMultiplierMap: Record<PaceType, number> = {
    min: 0.7,
    optimal: 1.0,
    max: 1.5,
  };

  // 1. Fetch the template with all nested data
  const { data: template, error: tmplError } = await supabase
    .from("guided_path_templates")
    .select(
      `
      id, name,
      guided_path_template_goals(
        *,
        guided_path_template_milestones(
          *,
          guided_path_template_tasks(*)
        )
      )
    `,
    )
    .eq("id", templateId)
    .single();

  if (tmplError) throw tmplError;
  if (!template) throw new Error("Template not found");

  // Sort nested data
  const goals = ((template.guided_path_template_goals || []) as TemplateGoal[])
    .sort((a, b) => a.order_index - b.order_index)
    .map((g) => ({
      ...g,
      guided_path_template_milestones: (g.guided_path_template_milestones || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((m) => ({
          ...m,
          guided_path_template_tasks: (m.guided_path_template_tasks || []).sort(
            (a, b) => a.order_index - b.order_index,
          ),
        })),
    }));

  // 2. Create instantiation record
  const { data: instantiation, error: instError } = await supabase
    .from("guided_path_instantiations" as string)
    .insert({
      user_id: userId,
      template_id: templateId,
      survey_response_id: surveyResponseId || null,
      pace_multiplier: paceMultiplierMap[paceType],
      started_at: startDate.toISOString(),
      status: "active",
    })
    .select("id")
    .single();

  if (instError) throw instError;
  const instantiationId = (instantiation as any).id as string;

  // 3. Create goals, milestones, tasks
  let currentDate = new Date(startDate);
  let goalsCreated = 0;
  let milestonesCreated = 0;
  let tasksCreated = 0;

  for (const templateGoal of goals) {
    const normalizedCategory: GoalCategory = VALID_GOAL_CATEGORIES.includes(
      templateGoal.category as GoalCategory,
    )
      ? (templateGoal.category as GoalCategory)
      : "personal_growth";

    const { data: newGoal, error: goalError } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        title: templateGoal.title,
        description: templateGoal.description,
        category: normalizedCategory,
        timeframe_type: normalizeTimeframe(templateGoal.timeframe_type),
        priority: templateGoal.priority,
        status: "not_started",
        progress_percentage: 0,
        template_goal_id: templateGoal.id,
        instantiation_id: instantiationId,
      })
      .select("id")
      .single();

    if (goalError) throw goalError;
    goalsCreated++;

    for (let mIdx = 0; mIdx < templateGoal.guided_path_template_milestones.length; mIdx++) {
      const templateMilestone = templateGoal.guided_path_template_milestones[mIdx];

      // Calculate due date based on pace
      if (mIdx > 0) {
        const prevMilestone = templateGoal.guided_path_template_milestones[mIdx - 1];
        const daysToAdd = getDaysForMilestone(prevMilestone, paceType);
        currentDate = addDays(currentDate, daysToAdd);
      }

      const { error: milestoneError } = await supabase
        .from("goal_milestones")
        .insert({
          goal_id: newGoal.id,
          title: templateMilestone.title,
          description: templateMilestone.description,
          status: "not_started",
          order_index: mIdx,
          due_date: format(currentDate, "yyyy-MM-dd"),
        });

      if (milestoneError) throw milestoneError;
      milestonesCreated++;

      // Create tasks
      for (const templateTask of templateMilestone.guided_path_template_tasks) {
        const { error: taskError } = await supabase.from("tasks").insert({
          user_id: userId,
          title: templateTask.title,
          description: templateTask.description,
          status: "todo",
          importance: templateTask.importance,
          urgency: templateTask.urgency,
          quadrant: getQuadrant(templateTask.importance, templateTask.urgency),
          goal_id: newGoal.id,
          category: templateGoal.category,
          source_type: "goal",
        });

        if (taskError) throw taskError;
        tasksCreated++;
      }

      // Move date forward for next milestone
      const nextDays = getDaysForMilestone(templateMilestone, paceType);
      if (nextDays > 0) {
        currentDate = addDays(currentDate, nextDays);
      }
    }
  }

  // 4. Update instantiation with estimated completion date
  await supabase
    .from("guided_path_instantiations" as string)
    .update({ estimated_completion_date: format(currentDate, "yyyy-MM-dd") })
    .eq("id", instantiationId);

  return {
    instantiationId,
    goalsCreated,
    milestonesCreated,
    tasksCreated,
    estimatedCompletionDate: currentDate,
  };
}

/**
 * Estimate the completion date for a template given a start date and pace.
 * (Used in the PathConfirmation preview before actual instantiation.)
 */
export function estimateCompletionDate(
  templateGoals: TemplateGoal[],
  startDate: Date,
  paceType: PaceType,
): Date {
  let currentDate = new Date(startDate);

  for (const goal of templateGoals) {
    for (let mIdx = 0; mIdx < goal.guided_path_template_milestones.length; mIdx++) {
      const milestone = goal.guided_path_template_milestones[mIdx];
      const days = getDaysForMilestone(milestone, paceType);
      currentDate = addDays(currentDate, days);
    }
  }

  return currentDate;
}
