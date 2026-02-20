import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { estimateCompletionDate } from "../guidedPathInstantiation";
import type { PaceType } from "../guidedPathInstantiation";

// ---------------------------------------------------------------------------
// Helpers to build template data structures matching the private types
// ---------------------------------------------------------------------------

interface MockTask {
  id: string;
  title: string;
  description: string | null;
  importance: boolean;
  urgency: boolean;
  order_index: number;
}

interface MockMilestone {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  recommended_days_min: number | null;
  recommended_days_optimal: number | null;
  recommended_days_max: number | null;
  guided_path_template_tasks: MockTask[];
}

interface MockGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  timeframe_type: string;
  priority: string;
  order_index: number;
  guided_path_template_milestones: MockMilestone[];
}

function makeMilestone(
  overrides: Partial<MockMilestone> = {},
): MockMilestone {
  return {
    id: "ms-1",
    title: "Milestone",
    description: null,
    order_index: 0,
    recommended_days_min: null,
    recommended_days_optimal: null,
    recommended_days_max: null,
    guided_path_template_tasks: [],
    ...overrides,
  };
}

function makeGoal(
  milestones: MockMilestone[] = [],
  overrides: Partial<MockGoal> = {},
): MockGoal {
  return {
    id: "goal-1",
    title: "Goal",
    description: null,
    category: "personal_growth",
    timeframe_type: "medium_term",
    priority: "high",
    order_index: 0,
    guided_path_template_milestones: milestones,
    ...overrides,
  };
}

const START = new Date("2026-03-01T00:00:00.000Z");

// ===========================================================================
// estimateCompletionDate
// ===========================================================================

describe("estimateCompletionDate", () => {
  // -- Basic pace selection --

  it("uses recommended_days_min for 'min' pace", () => {
    const goals = [
      makeGoal([makeMilestone({ recommended_days_min: 7, recommended_days_optimal: 14, recommended_days_max: 21 })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "min");
    expect(result).toEqual(addDays(START, 7));
  });

  it("uses recommended_days_optimal for 'optimal' pace", () => {
    const goals = [
      makeGoal([makeMilestone({ recommended_days_min: 7, recommended_days_optimal: 14, recommended_days_max: 21 })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 14));
  });

  it("uses recommended_days_max for 'max' pace", () => {
    const goals = [
      makeGoal([makeMilestone({ recommended_days_min: 7, recommended_days_optimal: 14, recommended_days_max: 21 })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "max");
    expect(result).toEqual(addDays(START, 21));
  });

  // -- Accumulation --

  it("accumulates days across multiple milestones", () => {
    const goals = [
      makeGoal([
        makeMilestone({ recommended_days_optimal: 10 }),
        makeMilestone({ recommended_days_optimal: 5, order_index: 1 }),
      ]),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 15)); // 10 + 5
  });

  it("accumulates days across multiple goals", () => {
    const goals = [
      makeGoal(
        [makeMilestone({ recommended_days_optimal: 7 })],
        { id: "g1", order_index: 0 },
      ),
      makeGoal(
        [makeMilestone({ recommended_days_optimal: 3 })],
        { id: "g2", order_index: 1 },
      ),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 10)); // 7 + 3
  });

  it("accumulates across multiple goals with multiple milestones each", () => {
    const goals = [
      makeGoal([
        makeMilestone({ recommended_days_optimal: 5 }),
        makeMilestone({ recommended_days_optimal: 5, order_index: 1 }),
      ], { id: "g1" }),
      makeGoal([
        makeMilestone({ recommended_days_optimal: 10 }),
      ], { id: "g2" }),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 20)); // 5+5+10
  });

  // -- Edge cases: empty --

  it("returns start date for empty goals array", () => {
    const result = estimateCompletionDate([], START, "optimal");
    expect(result).toEqual(START);
  });

  it("returns start date for goal with no milestones", () => {
    const goals = [makeGoal([])];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(START);
  });

  // -- Fallback chain --

  it("falls back to optimal when 'min' pace requested but min is null", () => {
    const goals = [
      makeGoal([makeMilestone({
        recommended_days_min: null,
        recommended_days_optimal: 14,
        recommended_days_max: 21,
      })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "min");
    expect(result).toEqual(addDays(START, 14)); // falls back to optimal
  });

  it("falls back to max when 'optimal' pace requested but optimal is null", () => {
    const goals = [
      makeGoal([makeMilestone({
        recommended_days_min: 7,
        recommended_days_optimal: null,
        recommended_days_max: 21,
      })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 21)); // falls back to max
  });

  it("falls back to min when optimal and max are both null", () => {
    const goals = [
      makeGoal([makeMilestone({
        recommended_days_min: 7,
        recommended_days_optimal: null,
        recommended_days_max: null,
      })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 7)); // falls back to min
  });

  it("falls back to 14 days when all recommended_days are null", () => {
    const goals = [
      makeGoal([makeMilestone({
        recommended_days_min: null,
        recommended_days_optimal: null,
        recommended_days_max: null,
      })]),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 14)); // DEFAULT_MILESTONE_DAYS
  });

  // -- Mixed scenarios --

  it("handles mix of null and non-null days across milestones", () => {
    const goals = [
      makeGoal([
        makeMilestone({ recommended_days_optimal: 10 }),
        makeMilestone({
          recommended_days_min: null,
          recommended_days_optimal: null,
          recommended_days_max: null,
          order_index: 1,
        }),
        makeMilestone({ recommended_days_optimal: 5, order_index: 2 }),
      ]),
    ];
    const result = estimateCompletionDate(goals as any, START, "optimal");
    // 10 + 14 (default) + 5 = 29
    expect(result).toEqual(addDays(START, 29));
  });

  // -- Date integrity --

  it("does not mutate the original start date", () => {
    const start = new Date("2026-06-15T00:00:00.000Z");
    const original = start.getTime();
    const goals = [
      makeGoal([makeMilestone({ recommended_days_optimal: 30 })]),
    ];
    estimateCompletionDate(goals as any, start, "optimal");
    expect(start.getTime()).toBe(original);
  });

  // -- Larger template --

  it("handles a larger template with many goals and milestones", () => {
    const goals = Array.from({ length: 5 }, (_, gi) =>
      makeGoal(
        Array.from({ length: 4 }, (_, mi) =>
          makeMilestone({
            id: `ms-${gi}-${mi}`,
            recommended_days_optimal: 3,
            order_index: mi,
          }),
        ),
        { id: `goal-${gi}`, order_index: gi },
      ),
    );
    // 5 goals × 4 milestones × 3 days = 60 days
    const result = estimateCompletionDate(goals as any, START, "optimal");
    expect(result).toEqual(addDays(START, 60));
  });
});
