import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContentPackage {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  package_type: "web" | "xapi";
  file_count: number;
  original_filename: string | null;
  uploaded_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  uploader_name?: string | null;
  module_count?: number;
}

export interface ContentPackageWithModules extends ContentPackage {
  modules: {
    id: string;
    title: string;
    program_id: string;
    program_name: string;
  }[];
}

/**
 * Fetch all active content packages with usage counts.
 */
export function useContentPackages() {
  return useQuery({
    queryKey: ["content-packages"],
    queryFn: async () => {
      // Fetch packages
      const { data: packages, error } = await supabase
        .from("content_packages" as string)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch module counts per package
      const { data: modules } = await supabase
        .from("program_modules")
        .select("id, content_package_id")
        .not("content_package_id", "is", null);

      const moduleCounts = new Map<string, number>();
      for (const m of modules || []) {
        const pkgId = m.content_package_id as string;
        moduleCounts.set(pkgId, (moduleCounts.get(pkgId) || 0) + 1);
      }

      // Fetch uploader names
      const uploaderIds = [...new Set((packages || []).map((p: any) => p.uploaded_by).filter(Boolean))];
      const uploaderNames = new Map<string, string>();
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uploaderIds);

        for (const p of profiles || []) {
          uploaderNames.set(p.id, p.full_name || p.email || "Unknown");
        }
      }

      return (packages || []).map((pkg: any) => ({
        ...pkg,
        uploader_name: uploaderNames.get(pkg.uploaded_by) || null,
        module_count: moduleCounts.get(pkg.id) || 0,
      })) as ContentPackage[];
    },
  });
}

/**
 * Fetch a single content package with its assigned modules.
 */
export function useContentPackage(id: string | undefined) {
  return useQuery({
    queryKey: ["content-package", id],
    queryFn: async () => {
      if (!id) return null;

      const { data: pkg, error } = await supabase
        .from("content_packages" as string)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch modules using this package
      const { data: modules } = await supabase
        .from("program_modules")
        .select("id, title, program_id, programs!inner(name)")
        .eq("content_package_id" as string, id);

      return {
        ...pkg,
        modules: (modules || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          program_id: m.program_id,
          program_name: m.programs?.name || "Unknown",
        })),
      } as ContentPackageWithModules;
    },
    enabled: !!id,
  });
}

/**
 * Fetch all content packages as a simple list (for combobox/dropdown pickers).
 */
export function useContentPackagesList() {
  return useQuery({
    queryKey: ["content-packages-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_packages" as string)
        .select("id, title, package_type")
        .eq("is_active", true)
        .order("title");

      if (error) throw error;
      return (data || []) as { id: string; title: string; package_type: string }[];
    },
  });
}

/**
 * Delete (deactivate) a content package.
 */
export function useDeleteContentPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("content_packages" as string)
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-packages"] });
      queryClient.invalidateQueries({ queryKey: ["content-packages-list"] });
    },
  });
}

/**
 * Assign a shared content package to a module.
 */
export function useAssignContentPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moduleId,
      contentPackageId,
    }: {
      moduleId: string;
      contentPackageId: string | null;
    }) => {
      const { error } = await supabase
        .from("program_modules")
        .update({ content_package_id: contentPackageId })
        .eq("id", moduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-packages"] });
      queryClient.invalidateQueries({ queryKey: ["content-packages-list"] });
    },
  });
}
