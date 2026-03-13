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

  const devItemsBuilder = new InlineQueryBuilder();

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
    from: fn().mockImplementation(() => devItemsBuilder),
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

  return { mockAuth, mockSupabase, devItemsBuilder };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hooks ────────────────────────────────────────────────────

import { useActionItems, useToggleActionItemStatus } from "@/hooks/useActionItems";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";

// ── Test data ───────────────────────────────────────────────────────

const sampleItems = [
  {
    id: "ai-1",
    title: "Review notes",
    content: "Go over coaching notes",
    status: "pending",
    due_date: "2026-02-01",
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    task_links: [],
  },
  {
    id: "ai-2",
    title: "Submit reflection",
    content: null,
    status: "completed",
    due_date: null,
    completed_at: "2026-01-15T00:00:00Z",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    task_links: [],
  },
];

// ── Helper ──────────────────────────────────────────────────────────

function resetBuilder() {
  const b = mocks.devItemsBuilder;
  b.select.mockReturnThis();
  b.update.mockReturnThis();
  b.delete.mockReturnThis();
  b.eq.mockReturnThis();
  b.or.mockReturnThis();
  b.order.mockReturnThis();
  b.limit.mockReturnThis();
  mocks.mockSupabase.from.mockImplementation(() => b);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useActionItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.mockAuth.user = { id: "user-1", email: "test@example.com" } as any;
    mocks.devItemsBuilder.resolvesWith(sampleItems);
  });

  it("returns undefined data when no user", async () => {
    mocks.mockAuth.user = null;

    const { result } = renderHookWithProviders(() => useActionItems());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // enabled: !!user is false, so data stays undefined
    expect(result.current.data).toBeUndefined();
    expect(mocks.devItemsBuilder.select).not.toHaveBeenCalled();
  });

  it("fetches with correct base filters", async () => {
    const { result } = renderHookWithProviders(() => useActionItems());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data!.length).toBe(2);
    });

    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("development_items");
    expect(mocks.devItemsBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.devItemsBuilder.eq).toHaveBeenCalledWith("item_type", "action_item");
    expect(mocks.devItemsBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("applies status filter for pending", async () => {
    const { result } = renderHookWithProviders(() =>
      useActionItems({ status: "pending" }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.devItemsBuilder.or).toHaveBeenCalledWith("status.eq.pending,status.is.null");
  });

  it("applies status filter for completed", async () => {
    const { result } = renderHookWithProviders(() =>
      useActionItems({ status: "completed" }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mocks.devItemsBuilder.eq).toHaveBeenCalledWith("status", "completed");
  });
});

describe("useToggleActionItemStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.devItemsBuilder.resolvesWith(null);
  });

  it("toggle to completed sets completed_at", async () => {
    const { result } = renderHookWithProviders(() =>
      useToggleActionItemStatus(),
    );

    await act(async () => {
      result.current.mutate({ itemId: "ai-1", newStatus: "completed" });
    });

    await waitFor(() => {
      expect(mocks.devItemsBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          completed_at: expect.any(String),
        }),
      );
    });

    expect(mocks.devItemsBuilder.eq).toHaveBeenCalledWith("id", "ai-1");
  });

  it("toggle to pending clears completed_at", async () => {
    const { result } = renderHookWithProviders(() =>
      useToggleActionItemStatus(),
    );

    await act(async () => {
      result.current.mutate({ itemId: "ai-2", newStatus: "pending" });
    });

    await waitFor(() => {
      expect(mocks.devItemsBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          completed_at: null,
        }),
      );
    });

    expect(mocks.devItemsBuilder.eq).toHaveBeenCalledWith("id", "ai-2");
  });
});
