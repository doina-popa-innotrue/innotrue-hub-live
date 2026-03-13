import { vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────

const { mockAuth, mockSb } = vi.hoisted(() => {
  const fn = vi.fn;
  return {
    mockAuth: {
      user: { id: "user-1" } as any,
      session: null,
      userRole: "client",
      userRoles: ["client"],
      organizationMembership: null,
      registrationStatus: null,
      loading: false,
      authError: null,
      signIn: fn(), signUp: fn(), signOut: fn(), switchRole: fn(), clearAuthError: fn(),
    },
    mockSb: {
      from: fn((_t: string) => {
        const self: any = {};
        ["select","insert","update","upsert","delete","eq","neq","in","not","or","filter","match","order","limit","range","is","gt","gte","lt","lte","ilike","contains","containedBy","textSearch"]
          .forEach((m) => { self[m] = fn().mockReturnValue(self); });
        self.single = fn().mockResolvedValue({ data: [], error: null });
        self.maybeSingle = fn().mockResolvedValue({ data: [], error: null });
        self.then = (onF?: any, onR?: any) => Promise.resolve({ data: [], error: null }).then(onF, onR);
        return self;
      }),
      rpc: fn((_fnName: string) => Promise.resolve({ data: null, error: null })),
      functions: { invoke: fn() },
      auth: { getSession: fn(), onAuthStateChange: fn(), getUser: fn(), signInWithPassword: fn(), signUp: fn(), signOut: fn() },
      channel: fn().mockReturnValue({ on: fn().mockReturnThis(), subscribe: fn().mockReturnThis(), unsubscribe: fn() }),
      removeChannel: fn(),
      storage: { from: fn() },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSb,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ── Import hook + utilities under test ─────────────────

import { useCreditBatches, formatCredits, formatPrice, calculateBonus } from "@/hooks/useCreditBatches";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";

// ── Helpers ─────────────────────────────────────────────

function configureRpcs(rpcs: Record<string, { data: any; error: any }>) {
  mockSb.rpc.mockImplementation((fnName: string) => {
    const result = rpcs[fnName] ?? { data: null, error: null };
    return Promise.resolve(result);
  });
}

const baseSummary = {
  plan_name: "Professional",
  plan_allowance: 100,
  period_start: "2026-03-01",
  period_end: "2026-03-31",
  period_usage: 20,
  plan_remaining: 80,
  feature_allocations: { ai_insights: 10 },
  feature_usage: { ai_insights: 3 },
  program_total: 50,
  program_used: 10,
  program_remaining: 40,
  program_details: [
    {
      program_id: "p1",
      program_name: "Leadership",
      feature_key: "ai_insights",
      total: 20,
      used: 5,
      remaining: 15,
    },
  ],
  bonus_credits: 25,
  bonus_batches: [
    {
      id: "batch-1",
      feature_key: null,
      remaining: 25,
      original: 50,
      expires_at: "2026-04-01T00:00:00Z",
      source_type: "purchase",
      description: "Purchased pack",
    },
  ],
  expiring_soon: 0,
  earliest_expiry: "2026-04-01T00:00:00Z",
  total_available: 145,
};

// ── Tests ───────────────────────────────────────────────

describe("useCreditBatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: "user-1" } as any;
    configureRpcs({});
  });

  it("returns totalAvailable=0 when user is null", async () => {
    mockAuth.user = null;

    const { result } = renderHookWithProviders(() => useCreditBatches());

    expect(result.current.totalAvailable).toBe(0);
    expect(result.current.summary).toBeUndefined();
  });

  it("calls RPC with correct user_id param", async () => {
    configureRpcs({
      get_user_credit_summary_v2: { data: baseSummary, error: null },
    });

    const { result } = renderHookWithProviders(() => useCreditBatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSb.rpc).toHaveBeenCalledWith("get_user_credit_summary_v2", {
      p_user_id: "user-1",
    });
  });

  it("returns summary data correctly when RPC succeeds", async () => {
    configureRpcs({
      get_user_credit_summary_v2: { data: baseSummary, error: null },
    });

    const { result } = renderHookWithProviders(() => useCreditBatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.summary).toBeTruthy();
    expect(result.current.summary?.plan_name).toBe("Professional");
    expect(result.current.summary?.plan_allowance).toBe(100);
    expect(result.current.planRemaining).toBe(80);
    expect(result.current.programRemaining).toBe(40);
    expect(result.current.bonusCredits).toBe(25);
  });

  it("totalAvailable reflects summary.total_available", async () => {
    configureRpcs({
      get_user_credit_summary_v2: { data: baseSummary, error: null },
    });

    const { result } = renderHookWithProviders(() => useCreditBatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.totalAvailable).toBe(145);
  });

  it("canConsume returns true when amount <= totalAvailable", async () => {
    configureRpcs({
      get_user_credit_summary_v2: { data: baseSummary, error: null },
    });

    const { result } = renderHookWithProviders(() => useCreditBatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canConsume(100)).toBe(true);
    expect(result.current.canConsume(145)).toBe(true);
  });

  it("canConsume returns false when amount > totalAvailable", async () => {
    configureRpcs({
      get_user_credit_summary_v2: { data: baseSummary, error: null },
    });

    const { result } = renderHookWithProviders(() => useCreditBatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canConsume(146)).toBe(false);
    expect(result.current.canConsume(500)).toBe(false);
  });

  it("consume calls consume_credits_fifo RPC with correct params", async () => {
    configureRpcs({
      get_user_credit_summary_v2: { data: baseSummary, error: null },
      consume_credits_fifo: {
        data: { success: true, consumed: 5, balance_after: 140 },
        error: null,
      },
    });

    const { result } = renderHookWithProviders(() => useCreditBatches());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let consumeResult: any;
    await act(async () => {
      consumeResult = await result.current.consume(5, "ai_insights", "AI analysis");
    });

    expect(consumeResult.success).toBe(true);
    expect(consumeResult.consumed).toBe(5);

    expect(mockSb.rpc).toHaveBeenCalledWith("consume_credits_fifo", {
      p_owner_type: "user",
      p_owner_id: "user-1",
      p_amount: 5,
      p_feature_key: "ai_insights",
      p_action_type: "general",
      p_action_reference_id: undefined,
      p_description: "AI analysis",
    });
  });

  it("formatCredits formats numbers correctly", () => {
    expect(formatCredits(0)).toBe("0");
    expect(formatCredits(1000)).toBe("1,000");
    expect(formatCredits(1234567)).toBe("1,234,567");
  });
});

// ── Exported utility function tests ─────────────────────

describe("formatPrice", () => {
  it("formats cents to EUR currency string", () => {
    const result = formatPrice(1500, "EUR");
    expect(result).toContain("15");
  });

  it("handles zero", () => {
    const result = formatPrice(0);
    expect(result).toContain("0");
  });
});

describe("calculateBonus", () => {
  it("returns 0 when priceCents is 0", () => {
    expect(calculateBonus(0, 100)).toBe(0);
  });

  it("returns 0 when creditValue equals expected", () => {
    expect(calculateBonus(1000, 10)).toBe(0);
  });

  it("calculates bonus percentage correctly", () => {
    expect(calculateBonus(1000, 15)).toBe(50);
  });

  it("returns 0 when creditValue is less than expected", () => {
    expect(calculateBonus(1000, 5)).toBe(0);
  });
});
