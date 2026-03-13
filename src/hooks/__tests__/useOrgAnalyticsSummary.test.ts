import { vi } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const fn = vi.fn;

  const mockAnalyticsData = {
    total_members: 25,
    date_from: "2026-01-01",
    date_to: "2026-03-31",
    enrollment_stats: { total: 40, active: 30, completed: 10, completion_rate: 25 },
    module_stats: { total: 100, completed: 60, completion_rate: 60 },
    scenario_stats: { total: 20, evaluated: 12 },
    capability_stats: { total: 15, completed: 10 },
    credit_stats: { total_purchased: 500, total_consumed: 200, available: 300 },
    program_breakdown: [],
    member_engagement: [],
    enrollment_trends: [],
  };

  const mockAuth = {
    user: { id: "user-1", email: "admin@org.com" } as any,
    session: { access_token: "tok" } as any,
    userRole: "org_admin" as string | null,
    userRoles: ["client", "org_admin"],
    organizationMembership: {
      organization_id: "org-1",
      organization_name: "Test Org",
      organization_slug: "test-org",
      role: "org_admin",
    },
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
    from: fn().mockReturnValue({
      select: fn().mockReturnThis(),
      eq: fn().mockReturnThis(),
      then: (onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
    }),
    rpc: fn().mockResolvedValue({ data: mockAnalyticsData, error: null }),
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

  return { mockAuth, mockSupabase, mockAnalyticsData };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hook ─────────────────────────────────────────────────────

import { useOrgAnalyticsSummary } from "@/hooks/useOrgAnalyticsSummary";
import { renderHookWithProviders, waitFor } from "@/test/test-utils";

// ── Tests ───────────────────────────────────────────────────────────

describe("useOrgAnalyticsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuth.user = { id: "user-1", email: "admin@org.com" } as any;
    mocks.mockSupabase.rpc.mockResolvedValue({ data: mocks.mockAnalyticsData, error: null });
  });

  it("returns undefined data when organizationId is undefined", async () => {
    const { result } = renderHookWithProviders(() =>
      useOrgAnalyticsSummary(undefined),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(mocks.mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("returns undefined data when user is null", async () => {
    mocks.mockAuth.user = null;

    const { result } = renderHookWithProviders(() =>
      useOrgAnalyticsSummary("org-1"),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(mocks.mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("calls RPC with correct params", async () => {
    const { result } = renderHookWithProviders(() =>
      useOrgAnalyticsSummary("org-1", {
        dateFrom: "2026-01-01",
        dateTo: "2026-03-31",
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.mockSupabase.rpc).toHaveBeenCalledWith(
      "get_org_analytics_summary",
      {
        p_org_id: "org-1",
        p_date_from: "2026-01-01",
        p_date_to: "2026-03-31",
      },
    );

    expect(result.current.data?.total_members).toBe(25);
  });

  it("passes null for omitted date params", async () => {
    const { result } = renderHookWithProviders(() =>
      useOrgAnalyticsSummary("org-1"),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.mockSupabase.rpc).toHaveBeenCalledWith(
      "get_org_analytics_summary",
      {
        p_org_id: "org-1",
        p_date_from: null,
        p_date_to: null,
      },
    );
  });

  it("propagates RPC error", async () => {
    mocks.mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "RPC failed", code: "42000" },
    });

    const { result } = renderHookWithProviders(() =>
      useOrgAnalyticsSummary("org-1"),
    );

    // The hook sets retry: 1, so React Query retries once before erroring
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.error).toBeDefined();
  });
});
