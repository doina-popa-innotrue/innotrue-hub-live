/**
 * Chainable Supabase client mock for hook tests.
 *
 * Usage:
 *   const builder = createMockQueryBuilder({ data: [{ id: '1' }], error: null });
 *   const mockSb = createMockSupabase({ tables: { profiles: builder } });
 *   vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSb }));
 */
import { vi } from "vitest";

// ── Types ──────────────────────────────────────────────

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
  count?: number | null;
}

// ── MockQueryBuilder ───────────────────────────────────

export class MockQueryBuilder {
  private _result: SupabaseResult = { data: null, error: null };

  /** Configure what this chain resolves to */
  resolvesWith<T>(data: T, error: SupabaseResult["error"] = null): this {
    this._result = { data, error };
    return this;
  }

  resolvesWithError(message: string, code?: string): this {
    this._result = { data: null, error: { message, code } };
    return this;
  }

  // ── Chainable filter / modifier methods ──
  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  update = vi.fn().mockReturnThis();
  upsert = vi.fn().mockReturnThis();
  delete = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();
  neq = vi.fn().mockReturnThis();
  in = vi.fn().mockReturnThis();
  not = vi.fn().mockReturnThis();
  or = vi.fn().mockReturnThis();
  filter = vi.fn().mockReturnThis();
  match = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();
  range = vi.fn().mockReturnThis();
  is = vi.fn().mockReturnThis();
  gt = vi.fn().mockReturnThis();
  gte = vi.fn().mockReturnThis();
  lt = vi.fn().mockReturnThis();
  lte = vi.fn().mockReturnThis();
  ilike = vi.fn().mockReturnThis();
  contains = vi.fn().mockReturnThis();
  containedBy = vi.fn().mockReturnThis();
  textSearch = vi.fn().mockReturnThis();

  // ── Terminal methods ──
  single = vi.fn().mockImplementation(() => Promise.resolve(this._result));
  maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(this._result));

  /** Makes the builder itself thenable (supports `await supabase.from('x').select()`) */
  then(
    onFulfilled?: (value: SupabaseResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve(this._result).then(onFulfilled, onRejected);
  }
}

// ── Factories ──────────────────────────────────────────

export function createMockQueryBuilder(
  result?: SupabaseResult,
): MockQueryBuilder {
  const builder = new MockQueryBuilder();
  if (result) builder.resolvesWith(result.data, result.error);
  return builder;
}

interface MockSupabaseConfig {
  tables?: Record<string, MockQueryBuilder>;
  rpcs?: Record<string, SupabaseResult>;
  functions?: Record<string, SupabaseResult>;
}

export function createMockSupabase(config: MockSupabaseConfig = {}) {
  const { tables = {}, rpcs = {}, functions = {} } = config;

  return {
    from: vi.fn((table: string) => {
      if (tables[table]) return tables[table];
      return createMockQueryBuilder({ data: [], error: null });
    }),

    rpc: vi.fn((fnName: string, _params?: unknown) => {
      const result = rpcs[fnName] ?? { data: null, error: null };
      return Promise.resolve(result);
    }),

    functions: {
      invoke: vi.fn((fnName: string, _options?: unknown) => {
        const result = functions[fnName] ?? { data: null, error: null };
        return Promise.resolve(result);
      }),
    },

    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },

    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),

    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: "mock" }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://mock" } }),
      }),
    },
  };
}
