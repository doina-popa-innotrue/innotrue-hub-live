/**
 * Test utilities for rendering React hooks with required providers.
 *
 * Usage:
 *   import { renderHookWithProviders } from "@/test/test-utils";
 *   const { result } = renderHookWithProviders(() => useMyHook());
 */
import React from "react";
import { renderHook, type RenderHookOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Re-export common testing utilities for convenience
export { renderHook, act, waitFor } from "@testing-library/react";

/** Create a fresh, isolated QueryClient for each test. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Build a wrapper component with QueryClientProvider. */
export function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient();

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
  };
}

/**
 * Convenience wrapper: renders a hook inside QueryClientProvider.
 * Auth is mocked at the module level via vi.mock, not via provider.
 */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  options?: Omit<RenderHookOptions<unknown>, "wrapper">,
) {
  const queryClient = createTestQueryClient();
  return {
    ...renderHook(hook, {
      wrapper: createWrapper(queryClient),
      ...options,
    }),
    queryClient,
  };
}
