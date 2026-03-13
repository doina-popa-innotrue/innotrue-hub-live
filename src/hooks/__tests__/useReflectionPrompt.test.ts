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

  const generatedPromptsBuilder = new InlineQueryBuilder();

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
    from: fn().mockImplementation(() => generatedPromptsBuilder),
    rpc: fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: fn().mockResolvedValue({
        data: { prompt: { id: "p-new", prompt_text: "Reflect on this week", status: "pending" } },
        error: null,
      }),
    },
    auth: {
      getSession: fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: fn().mockReturnValue({ data: { subscription: { unsubscribe: fn() } } }),
      getUser: fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    channel: fn().mockReturnValue({ on: fn().mockReturnThis(), subscribe: fn().mockReturnThis(), unsubscribe: fn() }),
    removeChannel: fn(),
    storage: { from: fn() },
  };

  return { mockAuth, mockSupabase, generatedPromptsBuilder };
});

// ── vi.mock ─────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hook ─────────────────────────────────────────────────────

import { useReflectionPrompt } from "@/hooks/useReflectionPrompt";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";

// ── Test data ───────────────────────────────────────────────────────

const existingPrompt = {
  id: "p-1",
  prompt_text: "What did you learn this week?",
  prompt_context: {},
  period_type: "weekly",
  period_start: "2026-01-06",
  status: "pending",
  response_item_id: null,
  generated_at: "2026-01-06T00:00:00Z",
  answered_at: null,
  skipped_at: null,
};

// ── Helper ──────────────────────────────────────────────────────────

function resetBuilder() {
  const b = mocks.generatedPromptsBuilder;
  b.select.mockReturnThis();
  b.update.mockReturnThis();
  b.eq.mockReturnThis();
  b.in.mockReturnThis();
  b.order.mockReturnThis();
  b.limit.mockReturnThis();
  b.maybeSingle.mockImplementation(function (this: any) { return Promise.resolve(this._result); });
  mocks.mockSupabase.from.mockImplementation(() => b);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("useReflectionPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBuilder();
    mocks.mockAuth.user = { id: "user-1", email: "test@example.com" } as any;
    mocks.mockAuth.session = { access_token: "tok" } as any;
    mocks.generatedPromptsBuilder.resolvesWith(null);
    mocks.mockSupabase.functions.invoke.mockResolvedValue({
      data: { prompt: { id: "p-new", prompt_text: "Reflect on this week", status: "pending" } },
      error: null,
    });
  });

  it("sets prompt to null when no user", async () => {
    mocks.mockAuth.user = null;
    mocks.mockAuth.session = null;

    const { result } = renderHookWithProviders(() => useReflectionPrompt());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.prompt).toBeNull();
  });

  it("fetches existing pending prompt on mount", async () => {
    mocks.generatedPromptsBuilder.resolvesWith(existingPrompt);

    renderHookWithProviders(() => useReflectionPrompt());

    await waitFor(() => {
      expect(mocks.mockSupabase.from).toHaveBeenCalledWith("generated_prompts");
    });

    expect(mocks.generatedPromptsBuilder.select).toHaveBeenCalledWith("*");
    expect(mocks.generatedPromptsBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.generatedPromptsBuilder.eq).toHaveBeenCalledWith("period_type", "weekly");
    expect(mocks.generatedPromptsBuilder.in).toHaveBeenCalledWith("status", ["pending", "answered"]);
    expect(mocks.generatedPromptsBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mocks.generatedPromptsBuilder.limit).toHaveBeenCalledWith(1);
    expect(mocks.generatedPromptsBuilder.maybeSingle).toHaveBeenCalled();
  });

  it("sets prompt when existing prompt found", async () => {
    mocks.generatedPromptsBuilder.resolvesWith(existingPrompt);

    const { result } = renderHookWithProviders(() => useReflectionPrompt());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.prompt).not.toBeNull();
    });

    expect(result.current.prompt?.id).toBe("p-1");
    expect(result.current.prompt?.prompt_text).toBe("What did you learn this week?");
    expect(result.current.prompt?.status).toBe("pending");
  });

  it("generatePrompt calls edge function with correct params", async () => {
    const { result } = renderHookWithProviders(() => useReflectionPrompt());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.generatePrompt("weekly", true);
    });

    expect(mocks.mockSupabase.functions.invoke).toHaveBeenCalledWith(
      "generate-reflection-prompt",
      { body: { periodType: "weekly", forceGenerate: true } },
    );
  });

  it("skipPrompt updates status to skipped", async () => {
    mocks.generatedPromptsBuilder.resolvesWith(existingPrompt);

    const { result } = renderHookWithProviders(() => useReflectionPrompt());

    await waitFor(() => {
      expect(result.current.prompt?.id).toBe("p-1");
    });

    await act(async () => {
      await result.current.skipPrompt();
    });

    expect(mocks.generatedPromptsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "skipped",
        skipped_at: expect.any(String),
      }),
    );
    expect(mocks.generatedPromptsBuilder.eq).toHaveBeenCalledWith("id", "p-1");
  });

  it("answerPrompt updates with responseItemId and answered_at", async () => {
    mocks.generatedPromptsBuilder.resolvesWith(existingPrompt);

    const { result } = renderHookWithProviders(() => useReflectionPrompt());

    await waitFor(() => {
      expect(result.current.prompt?.id).toBe("p-1");
    });

    await act(async () => {
      await result.current.answerPrompt("resp-item-42");
    });

    expect(mocks.generatedPromptsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered",
        answered_at: expect.any(String),
        response_item_id: "resp-item-42",
      }),
    );
    expect(mocks.generatedPromptsBuilder.eq).toHaveBeenCalledWith("id", "p-1");
  });
});
