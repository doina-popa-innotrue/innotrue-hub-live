import { describe, it, expect, vi, beforeEach } from "vitest";
import { addDays, format } from "date-fns";
import { estimateCompletionDate, instantiateTemplate } from "../guidedPathInstantiation";
import type { PaceType, InstantiationOptions } from "../guidedPathInstantiation";

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

// ===========================================================================
// instantiateTemplate — Supabase mocking
// ===========================================================================

/**
 * These tests verify the real business logic that instantiateTemplate executes:
 * - Quadrant mapping (importance × urgency → eisenhower quadrant)
 * - Category normalization (invalid categories → "personal_growth")
 * - Pace multiplier written to DB (min=0.7, optimal=1.0, max=1.5)
 * - Due-date sequencing across milestones
 * - Error propagation from Supabase
 * - Correct counts in result summary
 */

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

function createMockSupabase(templateData: any, options?: {
  templateError?: any;
  instantiationError?: any;
  goalError?: any;
  milestoneError?: any;
  taskError?: any;
}) {
  const insertedRows: Array<{ table: string; data: any }> = [];
  const updatedRows: Array<{ table: string; data: any; filter: any }> = [];
  let goalIdCounter = 0;

  const mockFrom = (table: string) => {
    const chainable = {
      select: (query?: string) => ({
        eq: (_col: string, _val: string) => ({
          single: () => {
            if (table === "guided_path_templates") {
              return Promise.resolve({
                data: options?.templateError ? null : templateData,
                error: options?.templateError || null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
      insert: (data: any) => {
        insertedRows.push({ table, data });
        return {
          select: (_fields?: string) => ({
            single: () => {
              if (table === "guided_path_instantiations") {
                if (options?.instantiationError) {
                  return Promise.resolve({ data: null, error: options.instantiationError });
                }
                return Promise.resolve({ data: { id: "inst-001" }, error: null });
              }
              if (table === "goals") {
                if (options?.goalError) {
                  return Promise.resolve({ data: null, error: options.goalError });
                }
                goalIdCounter++;
                return Promise.resolve({ data: { id: `goal-new-${goalIdCounter}` }, error: null });
              }
              return Promise.resolve({ data: { id: "generic-id" }, error: null });
            },
          }),
        };
      },
      update: (data: any) => ({
        eq: (col: string, val: string) => {
          updatedRows.push({ table, data, filter: { [col]: val } });
          return Promise.resolve({ error: null });
        },
      }),
    };

    // For tables that only use insert without .select().single() (milestones, tasks)
    const originalInsert = chainable.insert;
    chainable.insert = (data: any) => {
      const result = originalInsert(data);
      // Also support direct resolution (no .select chain) for milestones/tasks
      if (table === "goal_milestones") {
        if (options?.milestoneError) {
          return { ...result, then: undefined, error: options.milestoneError } as any;
        }
        return Object.assign(Promise.resolve({ error: options?.milestoneError || null }), result) as any;
      }
      if (table === "tasks") {
        if (options?.taskError) {
          return { ...result, then: undefined, error: options.taskError } as any;
        }
        return Object.assign(Promise.resolve({ error: options?.taskError || null }), result) as any;
      }
      return result;
    };

    return chainable;
  };

  return {
    from: vi.fn(mockFrom),
    _insertedRows: insertedRows,
    _updatedRows: updatedRows,
  };
}

// ---------------------------------------------------------------------------
// Template data factories for instantiateTemplate
// ---------------------------------------------------------------------------

function makeTemplateData(goals: any[] = []) {
  return {
    id: "tmpl-1",
    name: "Test Template",
    guided_path_template_goals: goals,
  };
}

function makeTemplateGoal(overrides: Partial<any> = {}) {
  return {
    id: "tg-1",
    title: "Template Goal",
    description: "A test goal",
    category: "career_business",
    timeframe_type: "medium_term",
    priority: "high",
    order_index: 0,
    guided_path_template_milestones: [],
    ...overrides,
  };
}

function makeTemplateMilestone(overrides: Partial<any> = {}) {
  return {
    id: "tm-1",
    title: "Template Milestone",
    description: null,
    order_index: 0,
    recommended_days_min: 5,
    recommended_days_optimal: 10,
    recommended_days_max: 20,
    guided_path_template_tasks: [],
    ...overrides,
  };
}

function makeTemplateTask(overrides: Partial<any> = {}) {
  return {
    id: "tt-1",
    title: "Template Task",
    description: "Do something",
    importance: true,
    urgency: false,
    order_index: 0,
    ...overrides,
  };
}

const defaultOptions: InstantiationOptions = {
  userId: "user-123",
  templateId: "tmpl-1",
  startDate: START,
  paceType: "optimal",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("instantiateTemplate", () => {
  // -- Happy path --

  it("creates instantiation record with correct pace multiplier (optimal = 1.0)", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const instInsert = supabase._insertedRows.find(r => r.table === "guided_path_instantiations");
    expect(instInsert).toBeDefined();
    expect(instInsert!.data.pace_multiplier).toBe(1.0);
    expect(instInsert!.data.status).toBe("active");
    expect(instInsert!.data.user_id).toBe("user-123");
  });

  it("creates instantiation record with min pace multiplier (0.7)", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, { ...defaultOptions, paceType: "min" });

    const instInsert = supabase._insertedRows.find(r => r.table === "guided_path_instantiations");
    expect(instInsert!.data.pace_multiplier).toBe(0.7);
  });

  it("creates instantiation record with max pace multiplier (1.5)", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, { ...defaultOptions, paceType: "max" });

    const instInsert = supabase._insertedRows.find(r => r.table === "guided_path_instantiations");
    expect(instInsert!.data.pace_multiplier).toBe(1.5);
  });

  it("returns correct counts for a single goal + milestone + task", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [
          makeTemplateMilestone({
            guided_path_template_tasks: [makeTemplateTask()],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    const result = await instantiateTemplate(supabase as any, defaultOptions);

    expect(result.instantiationId).toBe("inst-001");
    expect(result.goalsCreated).toBe(1);
    expect(result.milestonesCreated).toBe(1);
    expect(result.tasksCreated).toBe(1);
  });

  it("returns correct counts for multi-goal, multi-milestone, multi-task template", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        id: "tg-1",
        order_index: 0,
        guided_path_template_milestones: [
          makeTemplateMilestone({
            id: "tm-1",
            guided_path_template_tasks: [
              makeTemplateTask({ id: "tt-1" }),
              makeTemplateTask({ id: "tt-2", order_index: 1, importance: false, urgency: true }),
            ],
          }),
          makeTemplateMilestone({ id: "tm-2", order_index: 1 }),
        ],
      }),
      makeTemplateGoal({
        id: "tg-2",
        order_index: 1,
        guided_path_template_milestones: [
          makeTemplateMilestone({
            id: "tm-3",
            guided_path_template_tasks: [makeTemplateTask({ id: "tt-3" })],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    const result = await instantiateTemplate(supabase as any, defaultOptions);

    expect(result.goalsCreated).toBe(2);
    expect(result.milestonesCreated).toBe(3);
    expect(result.tasksCreated).toBe(3);
  });

  // -- Category normalization --

  it("normalizes valid categories (e.g. 'career_business' stays unchanged)", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        category: "health_fitness",
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const goalInsert = supabase._insertedRows.find(r => r.table === "goals");
    expect(goalInsert!.data.category).toBe("health_fitness");
  });

  it("normalizes invalid category to 'personal_growth'", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        category: "totally_invalid_category",
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const goalInsert = supabase._insertedRows.find(r => r.table === "goals");
    expect(goalInsert!.data.category).toBe("personal_growth");
  });

  // -- Quadrant mapping (tested via task inserts) --

  it("maps importance=true + urgency=true → 'important_urgent'", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [
          makeTemplateMilestone({
            guided_path_template_tasks: [
              makeTemplateTask({ importance: true, urgency: true }),
            ],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const taskInsert = supabase._insertedRows.find(r => r.table === "tasks");
    expect(taskInsert!.data.quadrant).toBe("important_urgent");
  });

  it("maps importance=true + urgency=false → 'important_not_urgent'", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [
          makeTemplateMilestone({
            guided_path_template_tasks: [
              makeTemplateTask({ importance: true, urgency: false }),
            ],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const taskInsert = supabase._insertedRows.find(r => r.table === "tasks");
    expect(taskInsert!.data.quadrant).toBe("important_not_urgent");
  });

  it("maps importance=false + urgency=true → 'not_important_urgent'", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [
          makeTemplateMilestone({
            guided_path_template_tasks: [
              makeTemplateTask({ importance: false, urgency: true }),
            ],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const taskInsert = supabase._insertedRows.find(r => r.table === "tasks");
    expect(taskInsert!.data.quadrant).toBe("not_important_urgent");
  });

  it("maps importance=false + urgency=false → 'not_important_not_urgent'", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [
          makeTemplateMilestone({
            guided_path_template_tasks: [
              makeTemplateTask({ importance: false, urgency: false }),
            ],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const taskInsert = supabase._insertedRows.find(r => r.table === "tasks");
    expect(taskInsert!.data.quadrant).toBe("not_important_not_urgent");
  });

  // -- Survey response ID --

  it("includes survey_response_id when provided", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, {
      ...defaultOptions,
      surveyResponseId: "survey-456",
    });

    const instInsert = supabase._insertedRows.find(r => r.table === "guided_path_instantiations");
    expect(instInsert!.data.survey_response_id).toBe("survey-456");
  });

  it("sets survey_response_id to null when not provided", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const instInsert = supabase._insertedRows.find(r => r.table === "guided_path_instantiations");
    expect(instInsert!.data.survey_response_id).toBeNull();
  });

  // -- Goal fields --

  it("sets correct goal fields (status, progress, template references)", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        id: "tg-abc",
        title: "My Goal",
        description: "Goal desc",
        priority: "high",
        timeframe_type: "long_term",
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const goalInsert = supabase._insertedRows.find(r => r.table === "goals");
    expect(goalInsert!.data).toMatchObject({
      user_id: "user-123",
      title: "My Goal",
      description: "Goal desc",
      priority: "high",
      timeframe_type: "long",
      status: "not_started",
      progress_percentage: 0,
      template_goal_id: "tg-abc",
      instantiation_id: "inst-001",
    });
  });

  // -- Task fields --

  it("sets correct task fields (source_type, goal_id, category)", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        category: "finances",
        guided_path_template_milestones: [
          makeTemplateMilestone({
            guided_path_template_tasks: [
              makeTemplateTask({ title: "Save money", description: "Budget monthly" }),
            ],
          }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const taskInsert = supabase._insertedRows.find(r => r.table === "tasks");
    expect(taskInsert!.data).toMatchObject({
      user_id: "user-123",
      title: "Save money",
      description: "Budget monthly",
      status: "todo",
      source_type: "goal",
      category: "finances",
      goal_id: "goal-new-1",
    });
  });

  // -- Error propagation --

  it("throws when template fetch fails", async () => {
    const supabase = createMockSupabase(null, {
      templateError: { message: "Template not found", code: "PGRST116" },
    });

    await expect(
      instantiateTemplate(supabase as any, defaultOptions),
    ).rejects.toEqual(
      expect.objectContaining({ message: "Template not found" }),
    );
  });

  it("throws when instantiation insert fails", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template, {
      instantiationError: { message: "Permission denied", code: "42501" },
    });

    await expect(
      instantiateTemplate(supabase as any, defaultOptions),
    ).rejects.toEqual(
      expect.objectContaining({ message: "Permission denied" }),
    );
  });

  it("throws when goal insert fails", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [makeTemplateMilestone()],
      }),
    ]);
    const supabase = createMockSupabase(template, {
      goalError: { message: "RLS violation", code: "42501" },
    });

    await expect(
      instantiateTemplate(supabase as any, defaultOptions),
    ).rejects.toEqual(
      expect.objectContaining({ message: "RLS violation" }),
    );
  });

  // -- Empty template --

  it("handles template with no goals (returns zero counts)", async () => {
    const template = makeTemplateData([]);
    const supabase = createMockSupabase(template);

    const result = await instantiateTemplate(supabase as any, defaultOptions);

    expect(result.goalsCreated).toBe(0);
    expect(result.milestonesCreated).toBe(0);
    expect(result.tasksCreated).toBe(0);
  });

  // -- Updates completion date in DB --

  it("updates instantiation record with estimated completion date", async () => {
    const template = makeTemplateData([
      makeTemplateGoal({
        guided_path_template_milestones: [
          makeTemplateMilestone({ recommended_days_optimal: 10 }),
        ],
      }),
    ]);
    const supabase = createMockSupabase(template);

    await instantiateTemplate(supabase as any, defaultOptions);

    const update = supabase._updatedRows.find(r => r.table === "guided_path_instantiations");
    expect(update).toBeDefined();
    expect(update!.data.estimated_completion_date).toBeDefined();
    expect(update!.filter.id).toBe("inst-001");
  });
});
