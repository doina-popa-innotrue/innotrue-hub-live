import { vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────
// vi.hoisted runs before vi.mock factories, so these are available to them.
// We build mock objects inline (no external requires).

const { mockAuth, mockSb } = vi.hoisted(() => {
  const fn = vi.fn;

  // Minimal mock auth
  const _mockAuth = {
    user: { id: "user-1" } as any,
    session: null,
    userRole: "client",
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

  // Minimal chainable query builder factory
  function makeBuilder(result: { data: any; error: any } = { data: [], error: null }) {
    const self: any = {
      _result: result,
      select: fn().mockReturnThis(),
      insert: fn().mockReturnThis(),
      update: fn().mockReturnThis(),
      upsert: fn().mockReturnThis(),
      delete: fn().mockReturnThis(),
      eq: fn().mockReturnThis(),
      neq: fn().mockReturnThis(),
      in: fn().mockReturnThis(),
      not: fn().mockReturnThis(),
      or: fn().mockReturnThis(),
      filter: fn().mockReturnThis(),
      match: fn().mockReturnThis(),
      order: fn().mockReturnThis(),
      limit: fn().mockReturnThis(),
      range: fn().mockReturnThis(),
      is: fn().mockReturnThis(),
      gt: fn().mockReturnThis(),
      gte: fn().mockReturnThis(),
      lt: fn().mockReturnThis(),
      lte: fn().mockReturnThis(),
      ilike: fn().mockReturnThis(),
      contains: fn().mockReturnThis(),
      containedBy: fn().mockReturnThis(),
      textSearch: fn().mockReturnThis(),
      single: fn().mockImplementation(() => Promise.resolve(result)),
      maybeSingle: fn().mockImplementation(() => Promise.resolve(result)),
      then(onFulfilled?: (v: any) => any, onRejected?: (r: any) => any) {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return self;
  }

  const _mockSb = {
    from: fn((_table: string) => makeBuilder()),
    rpc: fn((_fnName: string, _params?: any) => Promise.resolve({ data: null, error: null })),
    functions: { invoke: fn() },
    auth: { getSession: fn(), onAuthStateChange: fn(), getUser: fn(), signInWithPassword: fn(), signUp: fn(), signOut: fn() },
    channel: fn().mockReturnValue({ on: fn().mockReturnThis(), subscribe: fn().mockReturnThis(), unsubscribe: fn() }),
    removeChannel: fn(),
    storage: { from: fn() },
  };

  return { mockAuth: _mockAuth, mockSb: _mockSb, makeBuilder };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSb,
}));

// ── Import hook under test ─────────────────────────────

import { useEntitlements } from "@/hooks/useEntitlements";
import { renderHookWithProviders, waitFor } from "@/test/test-utils";
import { createMockQueryBuilder } from "@/test/mocks/supabase";

// ── Helpers ─────────────────────────────────────────────

function configureTables(tables: Record<string, ReturnType<typeof createMockQueryBuilder>>) {
  mockSb.from.mockImplementation((table: string) => {
    if (tables[table]) return tables[table];
    return createMockQueryBuilder({ data: [], error: null });
  });
}

// ── Tests ───────────────────────────────────────────────

describe("useEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: "user-1" } as any;
    configureTables({});
  });

  it("returns empty features when user is null (query disabled)", async () => {
    mockAuth.user = null;

    const { result } = renderHookWithProviders(() => useEntitlements());

    expect(result.current.hasFeature("anything")).toBe(false);
    expect(result.current.getLimit("anything")).toBeNull();
    expect(result.current.getAccessSource("anything")).toBeNull();
    expect(result.current.getAllEnabledFeatures()).toEqual([]);
  });

  it("returns isLoading=true initially, then resolves", async () => {
    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: null }, error: null }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("fetches subscription features from profiles + plan_features", async () => {
    const profilesBuilder = createMockQueryBuilder({
      data: { plan_id: "plan-1" },
      error: null,
    });
    const planFeaturesBuilder = createMockQueryBuilder({
      data: [
        { enabled: true, limit_value: 10, features: { key: "ai_insights" } },
        { enabled: true, limit_value: null, features: { key: "reports" } },
      ],
      error: null,
    });

    configureTables({ profiles: profilesBuilder, plan_features: planFeaturesBuilder });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasFeature("ai_insights")).toBe(true);
    expect(result.current.getLimit("ai_insights")).toBe(10);
    expect(result.current.getAccessSource("ai_insights")).toBe("subscription");
    expect(result.current.hasFeature("reports")).toBe(true);
    expect(result.current.getLimit("reports")).toBeNull();
  });

  it("fetches add-on features (non-expired)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: null }, error: null }),
      user_add_ons: createMockQueryBuilder({
        data: [{ add_on_id: "addon-1", expires_at: tomorrow.toISOString() }],
        error: null,
      }),
      add_on_features: createMockQueryBuilder({
        data: [{ features: { key: "premium_export" } }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasFeature("premium_export")).toBe(true);
    expect(result.current.getLimit("premium_export")).toBeNull();
    expect(result.current.getAccessSource("premium_export")).toBe("add_on");
  });

  it("filters out expired add-ons", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: null }, error: null }),
      user_add_ons: createMockQueryBuilder({
        data: [{ add_on_id: "addon-expired", expires_at: yesterday.toISOString() }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasFeature("premium_export")).toBe(false);
  });

  it("fetches track features for active tracks only", async () => {
    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: null }, error: null }),
      user_tracks: createMockQueryBuilder({
        data: [{ track_id: "track-1", is_active: true, tracks: { is_active: true } }],
        error: null,
      }),
      track_features: createMockQueryBuilder({
        data: [{ is_enabled: true, limit_value: 50, features: { key: "guided_paths" } }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasFeature("guided_paths")).toBe(true);
    expect(result.current.getLimit("guided_paths")).toBe(50);
    expect(result.current.getAccessSource("guided_paths")).toBe("track");
  });

  it("fetches program plan features via client_enrollments", async () => {
    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: null }, error: null }),
      client_enrollments: createMockQueryBuilder({
        data: [{
          program_plan_id: "pplan-1",
          tier: null,
          programs: { default_program_plan_id: null },
        }],
        error: null,
      }),
      program_plan_features: createMockQueryBuilder({
        data: [{ enabled: true, limit_value: 5, features: { key: "scenario_access" } }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasFeature("scenario_access")).toBe(true);
    expect(result.current.getLimit("scenario_access")).toBe(5);
    expect(result.current.getAccessSource("scenario_access")).toBe("program_plan");
  });

  it("priority resolution: add_on source wins over subscription for same key", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: "plan-1" }, error: null }),
      plan_features: createMockQueryBuilder({
        data: [{ enabled: true, limit_value: 10, features: { key: "ai_insights" } }],
        error: null,
      }),
      user_add_ons: createMockQueryBuilder({
        data: [{ add_on_id: "addon-1", expires_at: tomorrow.toISOString() }],
        error: null,
      }),
      add_on_features: createMockQueryBuilder({
        data: [{ features: { key: "ai_insights" } }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getAccessSource("ai_insights")).toBe("add_on");
  });

  it("limit merging: null (unlimited) wins over numeric", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: "plan-1" }, error: null }),
      plan_features: createMockQueryBuilder({
        data: [{ enabled: true, limit_value: 10, features: { key: "ai_insights" } }],
        error: null,
      }),
      user_add_ons: createMockQueryBuilder({
        data: [{ add_on_id: "addon-1", expires_at: tomorrow.toISOString() }],
        error: null,
      }),
      add_on_features: createMockQueryBuilder({
        data: [{ features: { key: "ai_insights" } }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getLimit("ai_insights")).toBeNull();
  });

  it("limit merging: max numeric wins when both have numbers", async () => {
    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: "plan-1" }, error: null }),
      plan_features: createMockQueryBuilder({
        data: [{ enabled: true, limit_value: 10, features: { key: "feature_x" } }],
        error: null,
      }),
      user_tracks: createMockQueryBuilder({
        data: [{ track_id: "track-1", is_active: true, tracks: { is_active: true } }],
        error: null,
      }),
      track_features: createMockQueryBuilder({
        data: [{ is_enabled: true, limit_value: 25, features: { key: "feature_x" } }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getLimit("feature_x")).toBe(25);
  });

  it("deny override blocks feature even when other sources grant it", async () => {
    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: "plan-1" }, error: null }),
      plan_features: createMockQueryBuilder({
        data: [
          { enabled: true, limit_value: null, features: { key: "ai_insights" }, is_restrictive: false },
          { enabled: false, limit_value: 0, features: { key: "ai_insights" }, is_restrictive: true },
        ],
        error: null,
      }),
      organization_members: createMockQueryBuilder({
        data: [{
          sponsored_plan_id: "org-plan-1",
          plans: { id: "org-plan-1", tier_level: 2 },
        }],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasFeature("ai_insights")).toBe(false);
  });

  it("getFeaturesByPrefix returns matching features", async () => {
    configureTables({
      profiles: createMockQueryBuilder({ data: { plan_id: "plan-1" }, error: null }),
      plan_features: createMockQueryBuilder({
        data: [
          { enabled: true, limit_value: null, features: { key: "ai_insights" } },
          { enabled: true, limit_value: 5, features: { key: "ai_reports" } },
          { enabled: true, limit_value: 10, features: { key: "reports_export" } },
        ],
        error: null,
      }),
    });

    const { result } = renderHookWithProviders(() => useEntitlements());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const aiFeatures = result.current.getFeaturesByPrefix("ai");
    expect(aiFeatures.has("ai_insights")).toBe(true);
    expect(aiFeatures.has("ai_reports")).toBe(true);
    expect(aiFeatures.has("reports_export")).toBe(false);
    expect(aiFeatures.size).toBe(2);
  });
});
