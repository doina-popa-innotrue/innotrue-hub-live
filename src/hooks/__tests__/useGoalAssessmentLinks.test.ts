import { vi } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const fn = vi.fn;

  class InlineQueryBuilder {
    _result: any = { data: null, error: null };
    resolvesWith(data: any, error: any = null) {
      this._result = { data, error };
      return this;
    }
    select = fn().mockReturnThis();
    insert = fn().mockReturnThis();
    update = fn().mockReturnThis();
    delete = fn().mockReturnThis();
    eq = fn().mockReturnThis();
    neq = fn().mockReturnThis();
    in = fn().mockReturnThis();
    not = fn().mockReturnThis();
    or = fn().mockReturnThis();
    order = fn().mockReturnThis();
    limit = fn().mockReturnThis();
    single = fn().mockImplementation(function (this: any) { return Promise.resolve(this._result); });
    maybeSingle = fn().mockImplementation(function (this: any) { return Promise.resolve(this._result); });
    then(onFulfilled?: (v: any) => any, onRejected?: (r: any) => any) {
      return Promise.resolve(this._result).then(onFulfilled, onRejected);
    }
  }

  const linksBuilder = new InlineQueryBuilder();

  const mockSupabase = {
    from: fn().mockImplementation(() => linksBuilder),
    rpc: fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: fn().mockResolvedValue({ data: null, error: null }) },
    auth: {
      getSession: fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: fn().mockReturnValue({ data: { subscription: { unsubscribe: fn() } } }),
      getUser: fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    channel: fn().mockReturnValue({ on: fn().mockReturnThis(), subscribe: fn().mockReturnThis(), unsubscribe: fn() }),
    removeChannel: fn(),
    storage: { from: fn() },
  };

  return { mockSupabase, linksBuilder };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hooks ────────────────────────────────────────────────────

import {
  useGoalAssessmentLink,
  useGoalAssessmentLinks,
  useCreateGoalAssessmentLink,
  useDeleteGoalAssessmentLink,
} from "@/hooks/useGoalAssessmentLinks";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";

// ── Test data ───────────────────────────────────────────────────────

const sampleLink = {
  id: "link-1",
  goal_id: "goal-1",
  capability_assessment_id: "ca-1",
  capability_domain_id: "dom-1",
  capability_snapshot_id: null,
  assessment_definition_id: null,
  psychometric_assessment_id: null,
  score_at_creation: 5,
  target_score: 8,
  notes: "Improve leadership",
  created_at: "2026-01-01T00:00:00Z",
  capability_domains: { name: "Leadership" },
  capability_assessments: { name: "Core Skills", rating_scale: 10 },
};

const sampleLinks = [
  { ...sampleLink },
  {
    ...sampleLink,
    id: "link-2",
    goal_id: "goal-2",
    capability_domains: { name: "Communication" },
    capability_assessments: { name: "Soft Skills", rating_scale: 5 },
  },
];

// ── Helper ──────────────────────────────────────────────────────────

function resetBuilder() {
  const b = mocks.linksBuilder;
  b.select.mockReturnThis();
  b.insert.mockReturnThis();
  b.delete.mockReturnThis();
  b.eq.mockReturnThis();
  b.in.mockReturnThis();
  b.order.mockReturnThis();
  b.limit.mockReturnThis();
  b.single.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
  b.maybeSingle.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
  mocks.mockSupabase.from.mockImplementation(() => b);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useGoalAssessmentLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.linksBuilder.resolvesWith(sampleLink);
  });

  it("returns undefined when goalId is undefined", async () => {
    const { result } = renderHookWithProviders(() =>
      useGoalAssessmentLink(undefined),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(mocks.linksBuilder.maybeSingle).not.toHaveBeenCalled();
  });

  it("fetches with correct filters and joins", async () => {
    const { result } = renderHookWithProviders(() =>
      useGoalAssessmentLink("goal-1"),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("goal_assessment_links");
    expect(mocks.linksBuilder.select).toHaveBeenCalled();
    expect(mocks.linksBuilder.eq).toHaveBeenCalledWith("goal_id", "goal-1");
    expect(mocks.linksBuilder.maybeSingle).toHaveBeenCalled();

    expect(result.current.data?.domain_name).toBe("Leadership");
    expect(result.current.data?.assessment_name).toBe("Core Skills");
  });
});

describe("useGoalAssessmentLinks (batch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.linksBuilder.resolvesWith(sampleLinks);
  });

  it("builds map keyed by goal_id", async () => {
    const { result } = renderHookWithProviders(() =>
      useGoalAssessmentLinks(["goal-1", "goal-2"]),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.linksBuilder.in).toHaveBeenCalledWith("goal_id", ["goal-1", "goal-2"]);

    const linkMap = result.current.data!;
    expect(linkMap["goal-1"]).toBeDefined();
    expect(linkMap["goal-1"].domain_name).toBe("Leadership");
    expect(linkMap["goal-2"]).toBeDefined();
    expect(linkMap["goal-2"].domain_name).toBe("Communication");
  });
});

describe("useCreateGoalAssessmentLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.linksBuilder.resolvesWith({ id: "link-new", goal_id: "goal-1" });
  });

  it("calls insert with select and single", async () => {
    const { result } = renderHookWithProviders(() =>
      useCreateGoalAssessmentLink(),
    );

    await act(async () => {
      result.current.mutate({
        goal_id: "goal-1",
        capability_assessment_id: "ca-1",
        capability_domain_id: "dom-1",
        target_score: 8,
      });
    });

    await waitFor(() => {
      expect(mocks.linksBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          goal_id: "goal-1",
          capability_assessment_id: "ca-1",
          capability_domain_id: "dom-1",
          target_score: 8,
        }),
      );
    });

    expect(mocks.linksBuilder.select).toHaveBeenCalled();
    expect(mocks.linksBuilder.single).toHaveBeenCalled();
  });
});

describe("useDeleteGoalAssessmentLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.linksBuilder.resolvesWith(null);
  });

  it("calls delete with correct id", async () => {
    const { result } = renderHookWithProviders(() =>
      useDeleteGoalAssessmentLink(),
    );

    await act(async () => {
      result.current.mutate({ id: "link-1", goalId: "goal-1" });
    });

    await waitFor(() => {
      expect(mocks.linksBuilder.delete).toHaveBeenCalled();
      expect(mocks.linksBuilder.eq).toHaveBeenCalledWith("id", "link-1");
    });
  });
});
