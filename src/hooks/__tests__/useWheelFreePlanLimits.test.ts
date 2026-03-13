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
    resolvesWithCount(count: number) {
      this._result = { data: null, error: null, count };
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

  const profilesBuilder = new InlineQueryBuilder();
  const enrollmentsBuilder = new InlineQueryBuilder();
  const programPlansBuilder = new InlineQueryBuilder();
  const goalsBuilder = new InlineQueryBuilder();
  const reflectionsBuilder = new InlineQueryBuilder();

  const mockAuth = {
    user: { id: "user-1", email: "test@example.com" } as any,
    session: { access_token: "tok" } as any,
    userRole: "client" as string | null,
    userRoles: ["client"],
    organizationMembership: null,
    registrationStatus: null,
    loading: false,
    authError: null,
    signIn: fn(),
    signUp: fn(),
    signOut: fn(),
    switchRole: fn(),
    clearAuthError: fn(),
  };

  const mockSupabase = {
    from: fn().mockImplementation((table: string) => {
      const map: Record<string, InlineQueryBuilder> = {
        profiles: profilesBuilder,
        client_enrollments: enrollmentsBuilder,
        program_plans: programPlansBuilder,
        goals: goalsBuilder,
        wheel_domain_reflections: reflectionsBuilder,
      };
      return map[table] ?? profilesBuilder;
    }),
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

  return {
    mockAuth,
    mockSupabase,
    profilesBuilder,
    enrollmentsBuilder,
    programPlansBuilder,
    goalsBuilder,
    reflectionsBuilder,
  };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hook ─────────────────────────────────────────────────────

import { useWheelFreePlanLimits } from "@/hooks/useWheelFreePlanLimits";
import { renderHookWithProviders, waitFor } from "@/test/test-utils";

// ── Helper ──────────────────────────────────────────────────────────

function resetBuilders() {
  for (const b of [
    mocks.profilesBuilder,
    mocks.enrollmentsBuilder,
    mocks.programPlansBuilder,
    mocks.goalsBuilder,
    mocks.reflectionsBuilder,
  ]) {
    b.select.mockReturnThis();
    b.eq.mockReturnThis();
    b.in.mockReturnThis();
    b.order.mockReturnThis();
    b.limit.mockReturnThis();
    b.single.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
    b.maybeSingle.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
  }
  mocks.mockSupabase.from.mockImplementation((table: string) => {
    const map: Record<string, any> = {
      profiles: mocks.profilesBuilder,
      client_enrollments: mocks.enrollmentsBuilder,
      program_plans: mocks.programPlansBuilder,
      goals: mocks.goalsBuilder,
      wheel_domain_reflections: mocks.reflectionsBuilder,
    };
    return map[table] ?? mocks.profilesBuilder;
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useWheelFreePlanLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilders();
    mocks.mockAuth.user = { id: "user-1", email: "test@example.com" } as any;

    // Defaults: free plan, no enrollments, 0 goals, 0 reflections
    mocks.profilesBuilder.resolvesWith({ plan_id: "free-plan", plans: { tier_level: 0 } });
    mocks.enrollmentsBuilder.resolvesWith([]);
    mocks.programPlansBuilder.resolvesWith([]);
    mocks.goalsBuilder.resolvesWithCount(0);
    mocks.reflectionsBuilder.resolvesWithCount(0);
  });

  it("returns isLoading false when no user", async () => {
    mocks.mockAuth.user = null;

    const { result } = renderHookWithProviders(() => useWheelFreePlanLimits());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isFreePlan).toBe(true);
  });

  it("returns unlimited for paid subscription (tier > 0)", async () => {
    mocks.profilesBuilder.resolvesWith({ plan_id: "pro-plan", plans: { tier_level: 2 } });

    const { result } = renderHookWithProviders(() => useWheelFreePlanLimits());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFreePlan).toBe(false);
    });

    expect(result.current.canAddGoal).toBe(true);
    expect(result.current.canAddReflection).toBe(true);
    expect(result.current.canViewHistory).toBe(true);
  });

  it("returns limits for free plan with counts under limit", async () => {
    mocks.profilesBuilder.resolvesWith({ plan_id: "free", plans: { tier_level: 0 } });
    mocks.goalsBuilder.resolvesWithCount(1);
    mocks.reflectionsBuilder.resolvesWithCount(1);

    const { result } = renderHookWithProviders(() => useWheelFreePlanLimits());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFreePlan).toBe(true);
    });

    expect(result.current.canAddGoal).toBe(true);
    expect(result.current.canAddReflection).toBe(true);
    expect(result.current.currentGoalCount).toBe(1);
    expect(result.current.currentReflectionCount).toBe(1);
  });

  it("returns canAddGoal=false when at limit", async () => {
    mocks.profilesBuilder.resolvesWith({ plan_id: "free", plans: { tier_level: 0 } });
    mocks.goalsBuilder.resolvesWithCount(3);
    mocks.reflectionsBuilder.resolvesWithCount(0);

    const { result } = renderHookWithProviders(() => useWheelFreePlanLimits());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFreePlan).toBe(true);
    });

    expect(result.current.canAddGoal).toBe(false);
    expect(result.current.currentGoalCount).toBe(3);
    expect(result.current.maxGoals).toBe(3);
  });

  it("returns canAddReflection=false when at limit", async () => {
    mocks.profilesBuilder.resolvesWith({ plan_id: "free", plans: { tier_level: 0 } });
    mocks.goalsBuilder.resolvesWithCount(0);
    mocks.reflectionsBuilder.resolvesWithCount(3);

    const { result } = renderHookWithProviders(() => useWheelFreePlanLimits());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isFreePlan).toBe(true);
    });

    expect(result.current.canAddReflection).toBe(false);
    expect(result.current.currentReflectionCount).toBe(3);
    expect(result.current.maxReflections).toBe(3);
  });
});
