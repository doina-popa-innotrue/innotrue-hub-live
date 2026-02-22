/**
 * Shared content access check for serve-content-package and xapi-launch.
 * Determines whether a user can access program content and whether it's read-only (alumni).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

export interface ContentAccessResult {
  allowed: boolean;
  readOnly: boolean;
  reason: "staff" | "active_enrollment" | "alumni_grace" | "denied";
  enrollmentId?: string;
  alumniInfo?: {
    daysRemaining: number;
    graceExpiresAt: string;
  };
}

export async function checkContentAccess(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  programId: string,
): Promise<ContentAccessResult> {
  // 1. Staff always have full access
  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const userRoles = (roles || []).map((r: { role: string }) => r.role);
  const isStaff =
    userRoles.includes("admin") ||
    userRoles.includes("instructor") ||
    userRoles.includes("coach");

  if (isStaff) {
    return { allowed: true, readOnly: false, reason: "staff" };
  }

  // 2. Active enrollment = full access
  const { data: activeEnrollment } = await serviceClient
    .from("client_enrollments")
    .select("id")
    .eq("client_user_id", userId)
    .eq("program_id", programId)
    .eq("status", "active")
    .limit(1);

  if (activeEnrollment && activeEnrollment.length > 0) {
    return {
      allowed: true,
      readOnly: false,
      reason: "active_enrollment",
      enrollmentId: activeEnrollment[0].id,
    };
  }

  // 3. Alumni grace period = read-only access
  const { data: alumniCheck } = await serviceClient.rpc("check_alumni_access", {
    p_user_id: userId,
    p_program_id: programId,
  });

  if (alumniCheck?.has_access) {
    return {
      allowed: true,
      readOnly: true,
      reason: "alumni_grace",
      enrollmentId: alumniCheck.enrollment_id || undefined,
      alumniInfo: {
        daysRemaining: alumniCheck.days_remaining ?? 0,
        graceExpiresAt: alumniCheck.grace_expires_at ?? "",
      },
    };
  }

  // 4. No access
  return { allowed: false, readOnly: true, reason: "denied" };
}
