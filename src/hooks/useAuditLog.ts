import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "restore"
  | "assign"
  | "unassign"
  | "approve"
  | "reject"
  | "export";

type EntityType =
  | "program"
  | "module"
  | "enrollment"
  | "user"
  | "cohort"
  | "assessment"
  | "badge"
  | "feature"
  | "plan"
  | "program_plan"
  | "track"
  | "group"
  | "resource";

interface AuditLogParams {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  oldValues?: Json;
  newValues?: Json;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async ({
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
  }: AuditLogParams) => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase.from("admin_audit_logs").insert([
        {
          admin_user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId || undefined,
          old_values: oldValues || null,
          new_values: newValues || null,
          user_agent: navigator.userAgent,
        },
      ]);

      if (error) {
        console.error("Failed to log audit action:", error);
      }
    } catch (err) {
      console.error("Error logging audit action:", err);
    }
  };

  return { logAction };
}
