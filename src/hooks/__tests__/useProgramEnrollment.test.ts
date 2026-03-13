import { vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────

const { mockAuth, mockSb, mockNavigate, mockConsume, mockCreditSummary } = vi.hoisted(() => {
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
    mockNavigate: fn(),
    mockConsume: fn(),
    mockCreditSummary: { total_available: 100 },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSb,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCreditBatches", () => ({
  useCreditBatches: () => ({
    summary: mockCreditSummary,
    consume: mockConsume,
  }),
}));

vi.mock("@/hooks/useDiscountCode", () => ({
  useDiscountCode: () => ({
    validateCode: vi.fn().mockResolvedValue(null),
    validatedDiscount: null,
    isValidating: false,
    validationError: null,
    clearDiscount: vi.fn(),
    recordUsage: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

// ── Import hook under test ─────────────────────────────

import { useProgramEnrollment } from "@/hooks/useProgramEnrollment";
import { renderHookWithProviders, act } from "@/test/test-utils";
import { createMockQueryBuilder } from "@/test/mocks/supabase";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────

function configureTables(tables: Record<string, ReturnType<typeof createMockQueryBuilder>>) {
  mockSb.from.mockImplementation((table: string) => {
    if (tables[table]) return tables[table];
    return createMockQueryBuilder({ data: [], error: null });
  });
}

function configureRpcs(rpcs: Record<string, { data: any; error: any }>) {
  mockSb.rpc.mockImplementation((fnName: string) => {
    const result = rpcs[fnName] ?? { data: null, error: null };
    return Promise.resolve(result);
  });
}

// ── Tests ───────────────────────────────────────────────

describe("useProgramEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: "user-1" } as any;
    mockCreditSummary.total_available = 100;
    configureTables({});
    configureRpcs({});
  });

  it("fetchTierPricing returns empty array when no tiers", async () => {
    configureTables({
      program_tier_plans: createMockQueryBuilder({ data: [], error: null }),
    });

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let pricing: any;
    await act(async () => {
      pricing = await result.current.fetchTierPricing("prog-1");
    });

    expect(pricing).toEqual([]);
  });

  it("fetchTierPricing returns tier data correctly", async () => {
    const tiers = [
      { tier_name: "Essentials", credit_cost: 0, program_plan_id: "pp-1" },
      { tier_name: "Premium", credit_cost: 50, program_plan_id: "pp-2" },
    ];
    configureTables({
      program_tier_plans: createMockQueryBuilder({ data: tiers, error: null }),
    });

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let pricing: any;
    await act(async () => {
      pricing = await result.current.fetchTierPricing("prog-1");
    });

    expect(pricing).toHaveLength(2);
    expect(pricing[0]).toEqual({ tier_name: "Essentials", credit_cost: 0, program_plan_id: "pp-1" });
    expect(pricing[1]).toEqual({ tier_name: "Premium", credit_cost: 50, program_plan_id: "pp-2" });
  });

  it("canAffordTier returns true when credits sufficient", async () => {
    configureTables({
      program_tier_plans: createMockQueryBuilder({
        data: [{ tier_name: "Premium", credit_cost: 50, program_plan_id: "pp-2" }],
        error: null,
      }),
    });

    mockCreditSummary.total_available = 100;

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    await act(async () => {
      await result.current.fetchTierPricing("prog-1");
    });

    const affordResult = result.current.canAffordTier("prog-1", "Premium");
    expect(affordResult.canAfford).toBe(true);
    expect(affordResult.creditCost).toBe(50);
    expect(affordResult.shortfall).toBe(0);
  });

  it("canAffordTier returns false with shortfall amount", async () => {
    configureTables({
      program_tier_plans: createMockQueryBuilder({
        data: [{ tier_name: "Enterprise", credit_cost: 200, program_plan_id: "pp-3" }],
        error: null,
      }),
    });

    mockCreditSummary.total_available = 50;

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    await act(async () => {
      await result.current.fetchTierPricing("prog-1");
    });

    const affordResult = result.current.canAffordTier("prog-1", "Enterprise");
    expect(affordResult.canAfford).toBe(false);
    expect(affordResult.creditCost).toBe(200);
    expect(affordResult.shortfall).toBe(150);
  });

  it("canAffordTier returns true when creditCost is null (free tier)", async () => {
    configureTables({
      program_tier_plans: createMockQueryBuilder({
        data: [{ tier_name: "Free", credit_cost: null, program_plan_id: null }],
        error: null,
      }),
    });

    mockCreditSummary.total_available = 0;

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    await act(async () => {
      await result.current.fetchTierPricing("prog-1");
    });

    const affordResult = result.current.canAffordTier("prog-1", "Free");
    expect(affordResult.canAfford).toBe(true);
    expect(affordResult.creditCost).toBeNull();
    expect(affordResult.shortfall).toBe(0);
  });

  it("enrollInProgram fails when user not logged in", async () => {
    mockAuth.user = null;

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let enrollResult: any;
    await act(async () => {
      enrollResult = await result.current.enrollInProgram("prog-1", "Premium");
    });

    expect(enrollResult.success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("You must be logged in to enroll");
  });

  it("enrollInProgram fails when at capacity", async () => {
    configureRpcs({
      check_program_capacity: {
        data: { has_capacity: false, enrolled_count: 30, capacity: 30 },
        error: null,
      },
    });

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let enrollResult: any;
    await act(async () => {
      enrollResult = await result.current.enrollInProgram("prog-1", "Premium");
    });

    expect(enrollResult.success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "This program is at full capacity (30/30).",
    );
  });

  it("enrollInProgram succeeds with credit consumption", async () => {
    configureRpcs({
      check_program_capacity: {
        data: { has_capacity: true, enrolled_count: 5, capacity: 30 },
        error: null,
      },
    });

    const tierBuilder = createMockQueryBuilder({
      data: [{ tier_name: "Premium", credit_cost: 50, program_plan_id: "pp-2" }],
      error: null,
    });
    const enrollmentBuilder = createMockQueryBuilder({
      data: { id: "enrollment-1" },
      error: null,
    });

    configureTables({
      program_tier_plans: tierBuilder,
      client_enrollments: enrollmentBuilder,
    });

    mockCreditSummary.total_available = 100;
    mockConsume.mockResolvedValue({ success: true });

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let enrollResult: any;
    await act(async () => {
      enrollResult = await result.current.enrollInProgram("prog-1", "Premium");
    });

    expect(enrollResult.success).toBe(true);
    expect(enrollResult.enrollmentId).toBe("enrollment-1");
    expect(mockConsume).toHaveBeenCalledWith(
      50, undefined, "Enrollment: Program tier Premium",
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Successfully enrolled!",
      expect.objectContaining({
        description: expect.stringContaining("50 credits deducted"),
      }),
    );
  });

  it("enrollInProgram handles duplicate enrollment (code 23505)", async () => {
    configureRpcs({
      check_program_capacity: { data: { has_capacity: true }, error: null },
    });

    const tierBuilder = createMockQueryBuilder({
      data: [{ tier_name: "Free", credit_cost: null, program_plan_id: null }],
      error: null,
    });
    const enrollmentBuilder = createMockQueryBuilder();
    enrollmentBuilder.resolvesWithError("duplicate key value", "23505");

    configureTables({
      program_tier_plans: tierBuilder,
      client_enrollments: enrollmentBuilder,
    });

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let enrollResult: any;
    await act(async () => {
      enrollResult = await result.current.enrollInProgram("prog-1", "Free");
    });

    expect(enrollResult.success).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "You are already enrolled in this program",
    );
  });

  it("enrollInProgram redirects when insufficient credits", async () => {
    configureRpcs({
      check_program_capacity: { data: { has_capacity: true }, error: null },
    });

    configureTables({
      program_tier_plans: createMockQueryBuilder({
        data: [{ tier_name: "Premium", credit_cost: 200, program_plan_id: "pp-2" }],
        error: null,
      }),
    });

    mockCreditSummary.total_available = 10;

    const { result } = renderHookWithProviders(() => useProgramEnrollment());

    let enrollResult: any;
    await act(async () => {
      enrollResult = await result.current.enrollInProgram("prog-1", "Premium");
    });

    expect(enrollResult.success).toBe(false);
    expect(enrollResult.insufficientCredits).toBe(true);
    expect(enrollResult.requiredCredits).toBe(200);
    expect(enrollResult.availableCredits).toBe(10);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/credits?return="),
    );
  });
});
