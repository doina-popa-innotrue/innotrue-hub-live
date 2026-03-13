import { vi } from "vitest";

// ── Hoisted: create all mock objects BEFORE vi.mock factories run ────

const mocks = vi.hoisted(() => {
  // Minimal inline mock builder (cannot import modules inside vi.hoisted)
  const fn = vi.fn;

  const mockChannel = {
    on: fn().mockReturnThis(),
    subscribe: fn().mockReturnThis(),
    unsubscribe: fn(),
  };

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

  const notificationsBuilder = new InlineQueryBuilder();

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
      if (table === "notifications") return notificationsBuilder;
      return notificationsBuilder; // fallback
    }),
    rpc: fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: fn().mockResolvedValue({ data: null, error: null }) },
    auth: {
      getSession: fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: fn().mockReturnValue({ data: { subscription: { unsubscribe: fn() } } }),
      getUser: fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    channel: fn().mockReturnValue(mockChannel),
    removeChannel: fn(),
    storage: { from: fn() },
  };

  return { mockAuth, mockSupabase, notificationsBuilder, mockChannel };
});

// ── vi.mock declarations (reference hoisted mocks) ──────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.mockAuth,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mocks.mockSupabase,
}));

// ── Import hook under test ──────────────────────────────────────────

import { useNotifications } from "@/hooks/useNotifications";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";

// ── Test data ───────────────────────────────────────────────────────

const sampleNotifications = [
  {
    id: "n1",
    user_id: "user-1",
    title: "Welcome",
    is_read: false,
    read_at: null,
    created_at: "2026-01-01T00:00:00Z",
    notification_types: { key: "welcome", name: "Welcome", icon: "bell", is_critical: false },
  },
  {
    id: "n2",
    user_id: "user-1",
    title: "Update",
    is_read: true,
    read_at: "2026-01-02T00:00:00Z",
    created_at: "2026-01-02T00:00:00Z",
    notification_types: null,
  },
  {
    id: "n3",
    user_id: "user-1",
    title: "Alert",
    is_read: false,
    read_at: null,
    created_at: "2026-01-03T00:00:00Z",
    notification_types: null,
  },
];

// ── Tests ───────────────────────────────────────────────────────────

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuth.user = { id: "user-1", email: "test@example.com" } as any;
    mocks.mockAuth.session = { access_token: "tok" } as any;
    mocks.notificationsBuilder.resolvesWith(sampleNotifications);

    // Re-apply mockReturnThis after clearAllMocks
    mocks.notificationsBuilder.select.mockReturnThis();
    mocks.notificationsBuilder.update.mockReturnThis();
    mocks.notificationsBuilder.delete.mockReturnThis();
    mocks.notificationsBuilder.eq.mockReturnThis();
    mocks.notificationsBuilder.in.mockReturnThis();
    mocks.notificationsBuilder.order.mockReturnThis();
    mocks.notificationsBuilder.limit.mockReturnThis();
    mocks.mockSupabase.from.mockImplementation((table: string) => mocks.notificationsBuilder);
    mocks.mockSupabase.channel.mockReturnValue(mocks.mockChannel);
    mocks.mockChannel.on.mockReturnThis();
    mocks.mockChannel.subscribe.mockReturnThis();
  });

  it("returns empty array when user is null", async () => {
    mocks.mockAuth.user = null;

    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  it("fetches notifications with correct query chain", async () => {
    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(3);
    });

    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("notifications");
    expect(mocks.notificationsBuilder.select).toHaveBeenCalled();
    expect(mocks.notificationsBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.notificationsBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mocks.notificationsBuilder.limit).toHaveBeenCalledWith(50);
  });

  it("computes unreadCount from is_read field", async () => {
    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });
  });

  it("markAsRead mutation calls update with correct params", async () => {
    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(3);
    });

    await act(async () => {
      result.current.markAsRead("n1");
    });

    expect(mocks.notificationsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_read: true, read_at: expect.any(String) }),
    );
    expect(mocks.notificationsBuilder.eq).toHaveBeenCalledWith("id", "n1");
  });

  it("markAllAsRead updates all unread for user", async () => {
    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(3);
    });

    await act(async () => {
      result.current.markAllAsRead();
    });

    expect(mocks.notificationsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_read: true, read_at: expect.any(String) }),
    );
    expect(mocks.notificationsBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.notificationsBuilder.eq).toHaveBeenCalledWith("is_read", false);
  });

  it("deleteNotification calls delete with correct id", async () => {
    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(3);
    });

    await act(async () => {
      result.current.deleteNotification("n2");
    });

    expect(mocks.notificationsBuilder.delete).toHaveBeenCalled();
    expect(mocks.notificationsBuilder.eq).toHaveBeenCalledWith("id", "n2");
  });

  it("clearAll deletes all for user", async () => {
    const { result } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.length).toBe(3);
    });

    await act(async () => {
      result.current.clearAll();
    });

    expect(mocks.notificationsBuilder.delete).toHaveBeenCalled();
    expect(mocks.notificationsBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("sets up and cleans up realtime channel", async () => {
    const { unmount } = renderHookWithProviders(() => useNotifications());

    await waitFor(() => {
      expect(mocks.mockSupabase.channel).toHaveBeenCalledWith("notifications-realtime");
    });

    expect(mocks.mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "*",
        schema: "public",
        table: "notifications",
        filter: "user_id=eq.user-1",
      }),
      expect.any(Function),
    );
    expect(mocks.mockChannel.subscribe).toHaveBeenCalled();

    unmount();

    expect(mocks.mockSupabase.removeChannel).toHaveBeenCalledWith(mocks.mockChannel);
  });
});
