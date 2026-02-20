import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

interface UseModuleSessionCapabilityOptions {
  moduleType?: string | null;
  moduleId?: string | null;
  enabled?: boolean;
}

interface ModuleSessionCapabilityResult {
  hasCapability: boolean | null; // null = unknown/loading
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Resilient hook to check if a module type supports sessions.
 *
 * Uses a dual-layer approach:
 * 1. First tries edge function (same-origin, bypasses browser privacy blocks)
 * 2. Falls back to direct RPC if edge function fails
 *
 * This ensures the session section is visible even when browsers block
 * cross-site requests to the Supabase API domain.
 */
export function useModuleSessionCapability({
  moduleType,
  moduleId,
  enabled = true,
}: UseModuleSessionCapabilityOptions): ModuleSessionCapabilityResult {
  const queryClient = useQueryClient();

  const queryKey = ["module-session-capability-resilient", moduleType, moduleId];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<{ hasMapping: boolean }> => {
      // Need either moduleType or moduleId
      if (!moduleType && !moduleId) {
        return { hasMapping: false };
      }

      // Strategy 1: Try edge function first (same-origin, ETP-safe)
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
          "check-module-capability",
          {
            body: { moduleType, moduleId },
          },
        );

        if (!edgeError && edgeData && typeof edgeData.hasMapping === "boolean") {
          return { hasMapping: edgeData.hasMapping };
        }
      } catch {
        // Edge function failed — fall back to direct RPC
      }

      // Strategy 2: Fall back to direct RPC (works when not blocked)
      try {
        let resolvedModuleType = moduleType;

        // If we only have moduleId, fetch the module type first
        if (!resolvedModuleType && moduleId) {
          const { data: moduleData, error: moduleError } = await supabase
            .from("program_modules")
            .select("module_type")
            .eq("id", moduleId)
            .single();

          if (moduleError) {
            throw new Error("Failed to fetch module type");
          }

          resolvedModuleType = moduleData?.module_type;
        }

        if (!resolvedModuleType) {
          return { hasMapping: false };
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "module_type_has_session_capability",
          { _module_type: resolvedModuleType },
        );

        if (rpcError) {
          throw new Error(`RPC failed: ${rpcError.message}`);
        }

        return { hasMapping: !!rpcData };
      } catch (rpcFetchError) {
        console.error("[Session Capability] All strategies failed:", rpcFetchError);
        throw rpcFetchError;
      }
    },
    enabled: enabled && (!!moduleType || !!moduleId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Retry once on failure
    retryDelay: 1000,
  });

  const retry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    refetch();
  }, [queryClient, queryKey, refetch]);

  return {
    hasCapability: data?.hasMapping ?? null,
    isLoading,
    isError,
    error: error as Error | null,
    retry,
  };
}
