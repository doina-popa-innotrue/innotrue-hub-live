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

  const assignmentsBuilder = new InlineQueryBuilder();
  const profilesBuilder = new InlineQueryBuilder();

  const mockAuth = {
    user: { id: "user-1", email: "admin@example.com" } as any,
    session: { access_token: "tok" } as any,
    userRole: "admin" as string | null,
    userRoles: ["admin"],
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
      if (table === "profiles") return profilesBuilder;
      return assignmentsBuilder;
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

  return { mockAuth, mockSupabase, assignmentsBuilder, profilesBuilder };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Imports ─────────────────────────────────────────────────────────

import {
  useScenarioAssignments,
  useScenarioAssignmentMutations,
} from "@/hooks/scenarios/useScenarioAssignments";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";

// ── Test data ───────────────────────────────────────────────────────

const sampleAssignments = [
  {
    id: "sa-1",
    template_id: "tmpl-1",
    user_id: "user-2",
    assigned_by: "user-1",
    evaluated_by: null,
    status: "draft",
    module_id: "mod-1",
    enrollment_id: "enr-1",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "sa-2",
    template_id: "tmpl-2",
    user_id: "user-3",
    assigned_by: "user-1",
    evaluated_by: "user-1",
    status: "evaluated",
    module_id: "mod-2",
    enrollment_id: "enr-2",
    created_at: "2026-01-02T00:00:00Z",
  },
];

const sampleProfiles = [
  { id: "user-1", name: "Admin User" },
  { id: "user-2", name: "Client A" },
  { id: "user-3", name: "Client B" },
];

// ── Helper to reset chainable mocks ────────────────────────────────

function resetBuilders() {
  const ab = mocks.assignmentsBuilder;
  const pb = mocks.profilesBuilder;
  for (const b of [ab, pb]) {
    b.select.mockReturnThis();
    b.insert.mockReturnThis();
    b.update.mockReturnThis();
    b.delete.mockReturnThis();
    b.eq.mockReturnThis();
    b.neq.mockReturnThis();
    b.in.mockReturnThis();
    b.order.mockReturnThis();
    b.limit.mockReturnThis();
    b.single.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
    b.maybeSingle.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
  }
  mocks.mockSupabase.from.mockImplementation((table: string) => {
    if (table === "profiles") return pb;
    return ab;
  });
}

// ── Tests: useScenarioAssignments ───────────────────────────────────

describe("useScenarioAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilders();
    mocks.mockAuth.user = { id: "user-1", email: "admin@example.com" } as any;
    mocks.assignmentsBuilder.resolvesWith(sampleAssignments);
    mocks.profilesBuilder.resolvesWith(sampleProfiles);
  });

  it("fetches assignments without filters", async () => {
    const { result } = renderHookWithProviders(() => useScenarioAssignments());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(2);
    });

    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("scenario_assignments");
    expect(mocks.assignmentsBuilder.select).toHaveBeenCalled();
    expect(mocks.assignmentsBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("applies userId filter", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignments({ userId: "user-2" }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.assignmentsBuilder.eq).toHaveBeenCalledWith("user_id", "user-2");
  });

  it("applies templateId filter", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignments({ templateId: "tmpl-1" }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.assignmentsBuilder.eq).toHaveBeenCalledWith("template_id", "tmpl-1");
  });

  it("applies status filter", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignments({ status: "evaluated" }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.assignmentsBuilder.eq).toHaveBeenCalledWith("status", "evaluated");
  });

  it("batch-fetches profiles for user_ids, assigned_by, evaluated_by", async () => {
    const { result } = renderHookWithProviders(() => useScenarioAssignments());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("profiles");
    expect(mocks.profilesBuilder.select).toHaveBeenCalledWith("id, name");
    expect(mocks.profilesBuilder.in).toHaveBeenCalledWith(
      "id",
      expect.arrayContaining(["user-1", "user-2", "user-3"]),
    );
  });
});

// ── Tests: useScenarioAssignmentMutations ───────────────────────────

describe("useScenarioAssignmentMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilders();
    mocks.mockAuth.user = { id: "user-1", email: "admin@example.com" } as any;
    mocks.assignmentsBuilder.resolvesWith({ id: "sa-new" });
  });

  it("create mutation inserts with correct fields", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignmentMutations(),
    );

    await act(async () => {
      result.current.createMutation.mutate({
        template_id: "tmpl-1",
        user_id: "user-2",
        enrollment_id: "enr-1",
        module_id: "mod-1",
      });
    });

    await waitFor(() => {
      expect(mocks.assignmentsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          template_id: "tmpl-1",
          user_id: "user-2",
          assigned_by: "user-1",
          enrollment_id: "enr-1",
          module_id: "mod-1",
        }),
      );
    });

    expect(mocks.assignmentsBuilder.select).toHaveBeenCalled();
    expect(mocks.assignmentsBuilder.single).toHaveBeenCalled();
  });

  it("update status to submitted sets submitted_at", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignmentMutations(),
    );

    await act(async () => {
      result.current.updateStatusMutation.mutate({
        id: "sa-1",
        status: "submitted",
      });
    });

    await waitFor(() => {
      expect(mocks.assignmentsBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "submitted",
          submitted_at: expect.any(String),
        }),
      );
    });

    expect(mocks.assignmentsBuilder.eq).toHaveBeenCalledWith("id", "sa-1");
  });

  it("update status to evaluated sets evaluated_at and evaluated_by", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignmentMutations(),
    );

    await act(async () => {
      result.current.updateStatusMutation.mutate({
        id: "sa-2",
        status: "evaluated",
      });
    });

    await waitFor(() => {
      expect(mocks.assignmentsBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "evaluated",
          evaluated_at: expect.any(String),
          evaluated_by: "user-1",
        }),
      );
    });
  });

  it("delete mutation calls delete with id", async () => {
    const { result } = renderHookWithProviders(() =>
      useScenarioAssignmentMutations(),
    );

    await act(async () => {
      result.current.deleteMutation.mutate("sa-1");
    });

    await waitFor(() => {
      expect(mocks.assignmentsBuilder.delete).toHaveBeenCalled();
      expect(mocks.assignmentsBuilder.eq).toHaveBeenCalledWith("id", "sa-1");
    });
  });
});
