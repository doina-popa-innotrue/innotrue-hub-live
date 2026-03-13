import { vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────

const { mockSb } = vi.hoisted(() => {
  const fn = vi.fn;

  const _mockSb = {
    from: fn((_table: string) => {
      // Default: returns empty chainable builder
      const self: any = {};
      const methods = [
        "select", "insert", "update", "upsert", "delete",
        "eq", "neq", "in", "not", "or", "filter", "match",
        "order", "limit", "range", "is", "gt", "gte", "lt", "lte",
        "ilike", "contains", "containedBy", "textSearch",
      ];
      methods.forEach((m) => { self[m] = fn().mockReturnValue(self); });
      self.single = fn().mockResolvedValue({ data: [], error: null });
      self.maybeSingle = fn().mockResolvedValue({ data: [], error: null });
      self.then = (onF?: any, onR?: any) => Promise.resolve({ data: [], error: null }).then(onF, onR);
      return self;
    }),
    rpc: fn(),
    functions: { invoke: fn() },
    auth: { getSession: fn(), onAuthStateChange: fn(), getUser: fn(), signInWithPassword: fn(), signUp: fn(), signOut: fn() },
    channel: fn().mockReturnValue({ on: fn().mockReturnThis(), subscribe: fn().mockReturnThis(), unsubscribe: fn() }),
    removeChannel: fn(),
    storage: { from: fn() },
  };

  return { mockSb: _mockSb };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSb,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ── Import hook under test ─────────────────────────────

import { useAdminCRUD } from "@/hooks/useAdminCRUD";
import { renderHookWithProviders, waitFor, act } from "@/test/test-utils";
import { createMockQueryBuilder } from "@/test/mocks/supabase";

// ── Types ───────────────────────────────────────────────

interface TestItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

type TestFormData = { name: string; slug: string; is_active: boolean };

const initialFormData: TestFormData = { name: "", slug: "", is_active: true };
const mapItemToForm = (item: TestItem): TestFormData => ({
  name: item.name,
  slug: item.slug,
  is_active: item.is_active,
});

function defaultOptions() {
  return {
    tableName: "test_items",
    queryKey: "admin-test-items",
    entityName: "Test item",
    initialFormData,
    mapItemToForm,
  };
}

// ── Helpers ─────────────────────────────────────────────

function configureTables(tables: Record<string, ReturnType<typeof createMockQueryBuilder>>) {
  mockSb.from.mockImplementation((table: string) => {
    if (tables[table]) return tables[table];
    return createMockQueryBuilder({ data: [], error: null });
  });
}

// ── Tests ───────────────────────────────────────────────

describe("useAdminCRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureTables({});
  });

  it("fetches data with correct table and select columns", async () => {
    const items: TestItem[] = [
      { id: "1", name: "Alpha", slug: "alpha", is_active: true },
      { id: "2", name: "Beta", slug: "beta", is_active: false },
    ];
    const builder = createMockQueryBuilder({ data: items, error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>({
        ...defaultOptions(),
        select: "id, name, slug, is_active",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSb.from).toHaveBeenCalledWith("test_items");
    expect(builder.select).toHaveBeenCalledWith("id, name, slug, is_active");
    expect(result.current.data).toEqual(items);
  });

  it("applies orderBy to query", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>({
        ...defaultOptions(),
        orderBy: "slug",
        orderDirection: "desc",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(builder.order).toHaveBeenCalledWith("slug", { ascending: false });
  });

  it("applies filters to query", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>({
        ...defaultOptions(),
        filters: [
          { column: "is_active", operator: "eq", value: true },
          { column: "name", operator: "ilike", value: "%test%" },
        ],
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(builder.filter).toHaveBeenCalledWith("is_active", "eq", true);
    expect(builder.filter).toHaveBeenCalledWith("name", "ilike", "%test%");
  });

  it("applies transform to fetched data", async () => {
    const rawItems: TestItem[] = [
      { id: "2", name: "Beta", slug: "beta", is_active: true },
      { id: "1", name: "Alpha", slug: "alpha", is_active: true },
    ];
    const builder = createMockQueryBuilder({ data: rawItems, error: null });
    configureTables({ test_items: builder });

    const transform = (items: TestItem[]) =>
      items.filter((i) => i.name === "Alpha");

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>({
        ...defaultOptions(),
        transform,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([
      { id: "1", name: "Alpha", slug: "alpha", is_active: true },
    ]);
  });

  it("openCreate resets form and opens dialog", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>(defaultOptions()),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.openCreate(); });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.editingItem).toBeNull();
    expect(result.current.formData).toEqual(initialFormData);
  });

  it("handleEdit sets editing item and maps form data", async () => {
    const items: TestItem[] = [
      { id: "1", name: "Alpha", slug: "alpha", is_active: true },
    ];
    const builder = createMockQueryBuilder({ data: items, error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>(defaultOptions()),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleEdit(items[0]); });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.editingItem).toEqual(items[0]);
    expect(result.current.formData).toEqual({
      name: "Alpha",
      slug: "alpha",
      is_active: true,
    });
  });

  it("handleSubmit in create mode calls insert", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>(defaultOptions()),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.openCreate(); });

    act(() => {
      result.current.setFormData({
        name: "New Item", slug: "new-item", is_active: true,
      });
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    act(() => { result.current.handleSubmit(fakeEvent); });

    expect(fakeEvent.preventDefault).toHaveBeenCalled();

    // Mutation fires async — wait for it
    await waitFor(() => {
      expect(builder.insert).toHaveBeenCalledWith([
        { name: "New Item", slug: "new-item", is_active: true },
      ]);
    });
  });

  it("handleSubmit in edit mode calls update with correct id", async () => {
    const existingItem: TestItem = {
      id: "item-1", name: "Old", slug: "old", is_active: true,
    };
    const builder = createMockQueryBuilder({ data: [existingItem], error: null });
    configureTables({ test_items: builder });

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>(defaultOptions()),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleEdit(existingItem); });

    act(() => {
      result.current.setFormData({
        name: "Updated", slug: "updated", is_active: false,
      });
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    act(() => { result.current.handleSubmit(fakeEvent); });

    // Mutation fires async — wait for it
    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({
        name: "Updated", slug: "updated", is_active: false,
      });
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "item-1");
  });

  it("handleDelete calls delete when confirmed", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    configureTables({ test_items: builder });

    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>(defaultOptions()),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleDelete("item-to-delete"); });

    expect(confirmSpy).toHaveBeenCalledWith("Delete this test item?");

    // Mutation fires async — wait for it
    await waitFor(() => {
      expect(builder.delete).toHaveBeenCalled();
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "item-to-delete");

    confirmSpy.mockRestore();
  });

  it("handleDelete does nothing when cancelled", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    configureTables({ test_items: builder });

    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

    const { result } = renderHookWithProviders(() =>
      useAdminCRUD<TestItem, TestFormData>(defaultOptions()),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleDelete("item-to-keep"); });

    expect(confirmSpy).toHaveBeenCalled();
    expect(builder.delete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
