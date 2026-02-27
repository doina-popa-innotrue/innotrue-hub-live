/**
 * Deno global mock for running edge function tests in Vitest (Node/jsdom).
 *
 * Usage: call `setupDenoMock(envOverrides)` in beforeEach(), and
 * `cleanupDenoMock()` in afterEach() to restore the original global state.
 *
 * This allows importing edge function _shared utilities that reference
 * `Deno.env.get()` without actually running in Deno.
 */

// Store original Deno if it somehow exists (it shouldn't in Node)
const _originalDeno = (globalThis as Record<string, unknown>).Deno;

/**
 * Install a mock Deno global with the given env vars.
 */
export function setupDenoMock(envOverrides: Record<string, string> = {}): void {
  const envMap = new Map(Object.entries(envOverrides));

  (globalThis as Record<string, unknown>).Deno = {
    env: {
      get(key: string): string | undefined {
        return envMap.get(key);
      },
      set(key: string, value: string): void {
        envMap.set(key, value);
      },
      delete(key: string): void {
        envMap.delete(key);
      },
      toObject(): Record<string, string> {
        return Object.fromEntries(envMap);
      },
    },
  };
}

/**
 * Restore the original global state (remove Deno mock).
 */
export function cleanupDenoMock(): void {
  if (_originalDeno !== undefined) {
    (globalThis as Record<string, unknown>).Deno = _originalDeno;
  } else {
    delete (globalThis as Record<string, unknown>).Deno;
  }
}
