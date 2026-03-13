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

  const featuresBuilder = new InlineQueryBuilder();
  const planFeaturesBuilder = new InlineQueryBuilder();
  const trackFeaturesBuilder = new InlineQueryBuilder();
  const addOnFeaturesBuilder = new InlineQueryBuilder();
  const programPlanFeaturesBuilder = new InlineQueryBuilder();

  const mockAuth = {
    user: { id: "user-1" } as any,
    session: { access_token: "tok" } as any,
    userRole: "client" as string | null,
    userRoles: ["client"] as string[],
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

  let mockHasFeature = fn().mockReturnValue(false);

  const mockSupabase = {
    from: fn().mockImplementation((table: string) => {
      const map: Record<string, InlineQueryBuilder> = {
        features: featuresBuilder,
        plan_features: planFeaturesBuilder,
        track_features: trackFeaturesBuilder,
        add_on_features: addOnFeaturesBuilder,
        program_plan_features: programPlanFeaturesBuilder,
      };
      return map[table] ?? featuresBuilder;
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
    featuresBuilder,
    planFeaturesBuilder,
    trackFeaturesBuilder,
    addOnFeaturesBuilder,
    programPlanFeaturesBuilder,
    getMockHasFeature: () => mockHasFeature,
    setMockHasFeature: (newFn: any) => { mockHasFeature = newFn; },
  };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    hasFeature: (...args: any[]) => mocks.getMockHasFeature()(...args),
    isLoading: false,
    getLimit: vi.fn().mockReturnValue(null),
    getAccessSource: vi.fn().mockReturnValue(null),
    getFeaturesByPrefix: vi.fn().mockReturnValue(new Set()),
    getAllEnabledFeatures: vi.fn().mockReturnValue([]),
    refetch: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hook ─────────────────────────────────────────────────────

import { useFeatureVisibility } from "@/hooks/useFeatureVisibility";
import { renderHookWithProviders, waitFor } from "@/test/test-utils";

// ── Helper ──────────────────────────────────────────────────────────

function resetBuilders() {
  for (const b of [
    mocks.featuresBuilder,
    mocks.planFeaturesBuilder,
    mocks.trackFeaturesBuilder,
    mocks.addOnFeaturesBuilder,
    mocks.programPlanFeaturesBuilder,
  ]) {
    b.select.mockReturnThis();
    b.eq.mockReturnThis();
    b.in.mockReturnThis();
    b.order.mockReturnThis();
    b.limit.mockReturnThis();
    b.maybeSingle.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
  }
  mocks.mockSupabase.from.mockImplementation((table: string) => {
    const map: Record<string, any> = {
      features: mocks.featuresBuilder,
      plan_features: mocks.planFeaturesBuilder,
      track_features: mocks.trackFeaturesBuilder,
      add_on_features: mocks.addOnFeaturesBuilder,
      program_plan_features: mocks.programPlanFeaturesBuilder,
    };
    return map[table] ?? mocks.featuresBuilder;
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useFeatureVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilders();
    mocks.mockAuth.user = { id: "user-1" } as any;
    mocks.mockAuth.userRoles = ["client"];
    mocks.setMockHasFeature(vi.fn().mockReturnValue(false));

    // Default: feature not found
    mocks.featuresBuilder.resolvesWith(null);
    // Default: no monetization
    mocks.planFeaturesBuilder.resolvesWith([]);
    mocks.trackFeaturesBuilder.resolvesWith([]);
    mocks.addOnFeaturesBuilder.resolvesWith([]);
    mocks.programPlanFeaturesBuilder.resolvesWith([]);
  });

  it("returns accessible when featureKey is null", () => {
    const { result } = renderHookWithProviders(() => useFeatureVisibility(null));

    expect(result.current.visibility).toBe("accessible");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.requiredPlan).toBeNull();
  });

  it("returns accessible when featureKey is undefined", () => {
    const { result } = renderHookWithProviders(() => useFeatureVisibility(undefined));

    expect(result.current.visibility).toBe("accessible");
    expect(result.current.isLoading).toBe(false);
  });

  it("returns accessible when feature not found in DB", async () => {
    mocks.featuresBuilder.resolvesWith(null);

    const { result } = renderHookWithProviders(() =>
      useFeatureVisibility("nonexistent_feature"),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visibility).toBe("accessible");
  });

  it("returns hidden for inactive feature (client role)", async () => {
    mocks.featuresBuilder.resolvesWith({ id: "f1", key: "premium_reports", is_active: false });

    const { result } = renderHookWithProviders(() =>
      useFeatureVisibility("premium_reports"),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visibility).toBe("hidden");
    expect(result.current.hiddenReason).toBe("inactive");
  });

  it("returns locked for inactive feature (admin role)", async () => {
    mocks.mockAuth.userRoles = ["admin"];

    mocks.featuresBuilder.resolvesWith({ id: "f1", key: "premium_reports", is_active: false });

    const { result } = renderHookWithProviders(() =>
      useFeatureVisibility("premium_reports"),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visibility).toBe("locked");
    expect(result.current.hiddenReason).toBe("inactive");
  });

  it("returns accessible when user has entitlement", async () => {
    mocks.setMockHasFeature(vi.fn().mockReturnValue(true));

    mocks.featuresBuilder.resolvesWith({ id: "f1", key: "skills_map", is_active: true });
    mocks.planFeaturesBuilder.resolvesWith([
      { feature_id: "f1", plans: { name: "Pro", tier_level: 1, display_name: "Pro Plan" } },
    ]);

    const { result } = renderHookWithProviders(() =>
      useFeatureVisibility("skills_map"),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.visibility).toBe("accessible");
    expect(result.current.requiredPlan).toBeNull();
  });
});
