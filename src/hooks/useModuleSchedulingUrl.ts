import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseModuleSchedulingUrlOptions {
  moduleType: string;
  moduleId: string;
  programId: string;
  enrollmentId?: string; // Optional - for client-specific instructor resolution
  enabled?: boolean;
}

interface ModuleSchedulingResult {
  schedulingUrl: string | null;
  eventTypeId: number | null;
  resolvedInstructorId: string | null; // The instructor whose calendar is being used
}

/**
 * Hook to fetch the correct Cal.com scheduling URL for a module
 * based on the module's type and hierarchical instructor assignment.
 *
 * Resolution Priority:
 * 1. Enrollment-specific instructor (enrollment_module_staff) → their child event type
 * 2. Module-level instructor (module_instructors) → their child event type
 * 3. Program-level instructor (program_instructors) → their child event type
 * 4. Direct scheduling_url from calcom_event_type_mappings (if set)
 * 5. Fetch URL from Cal.com API using event_type_id (if no URL but ID exists)
 * 6. Fall back to instructor/coach profile scheduling_url
 */
export function useModuleSchedulingUrl({
  moduleType,
  moduleId,
  programId,
  enrollmentId,
  enabled = true,
}: UseModuleSchedulingUrlOptions) {
  return useQuery({
    queryKey: ["module-scheduling-url", moduleType, moduleId, programId, enrollmentId],
    queryFn: async (): Promise<ModuleSchedulingResult> => {
      let resolvedInstructorId: string | null = null;

      // Helper function to get instructor's child event type ID and resolve booking URL
      const getInstructorBookingUrl = async (
        instructorId: string,
      ): Promise<ModuleSchedulingResult | null> => {
        // Look up instructor's child event type for this module type
        const { data: instructorEventType } = await supabase
          .from("instructor_calcom_event_types")
          .select("child_event_type_id, booking_url")
          .eq("instructor_id", instructorId)
          .eq("module_type", moduleType)
          .maybeSingle();

        if (instructorEventType) {
          // Priority 1: Use directly stored booking_url if available
          if (instructorEventType.booking_url) {
            return {
              schedulingUrl: instructorEventType.booking_url,
              eventTypeId: instructorEventType.child_event_type_id,
              resolvedInstructorId: instructorId,
            };
          }

          // Priority 2: Try to fetch booking URL from Cal.com API
          if (instructorEventType.child_event_type_id) {
            try {
              const { data: urlResult, error: urlError } = await supabase.functions.invoke(
                "calcom-get-booking-url",
                { body: { eventTypeId: instructorEventType.child_event_type_id } },
              );

              // Check for successful response with booking URL
              if (!urlError && urlResult?.success !== false && urlResult?.bookingUrl) {
                return {
                  schedulingUrl: urlResult.bookingUrl,
                  eventTypeId: instructorEventType.child_event_type_id,
                  resolvedInstructorId: instructorId,
                };
              }

              // Log if event type not found (allows fallback to profile URL)
              if (urlResult?.error === "event_type_not_found") {
                console.warn(
                  `Cal.com event type ${instructorEventType.child_event_type_id} not found, falling back to profile URL`,
                );
              }
            } catch (err) {
              console.error("Error fetching booking URL from Cal.com:", err);
            }
          }
        }

        // Fallback to instructor's profile scheduling URL
        const { data: instructorProfile } = await supabase
          .from("profiles")
          .select("scheduling_url")
          .eq("id", instructorId)
          .single();

        if (instructorProfile?.scheduling_url) {
          return {
            schedulingUrl: instructorProfile.scheduling_url,
            eventTypeId: instructorEventType?.child_event_type_id || null,
            resolvedInstructorId: instructorId,
          };
        }

        return null;
      };

      // 1. Check enrollment-specific instructor assignment (highest priority for personalized modules)
      if (enrollmentId) {
        const { data: enrollmentStaff } = await supabase
          .from("enrollment_module_staff")
          .select("instructor_id, coach_id")
          .eq("enrollment_id", enrollmentId)
          .eq("module_id", moduleId)
          .maybeSingle();

        if (enrollmentStaff) {
          const staffId = enrollmentStaff.instructor_id || enrollmentStaff.coach_id;
          if (staffId) {
            const result = await getInstructorBookingUrl(staffId);
            if (result) return result;
            resolvedInstructorId = staffId;
          }
        }
      }

      // 2. Check module-level instructor assignment
      const { data: moduleInstructors } = await supabase
        .from("module_instructors")
        .select("instructor_id")
        .eq("module_id", moduleId)
        .limit(1);

      if (moduleInstructors && moduleInstructors.length > 0) {
        const result = await getInstructorBookingUrl(moduleInstructors[0].instructor_id);
        if (result) return result;
        resolvedInstructorId = moduleInstructors[0].instructor_id;
      }

      // 3. Check module-level coach assignment
      const { data: moduleCoaches } = await supabase
        .from("module_coaches")
        .select("coach_id")
        .eq("module_id", moduleId)
        .limit(1);

      if (moduleCoaches && moduleCoaches.length > 0) {
        const result = await getInstructorBookingUrl(moduleCoaches[0].coach_id);
        if (result) return result;
        resolvedInstructorId = moduleCoaches[0].coach_id;
      }

      // 4. Check program-level instructor assignment
      const { data: programInstructors } = await supabase
        .from("program_instructors")
        .select("instructor_id")
        .eq("program_id", programId)
        .limit(1);

      if (programInstructors && programInstructors.length > 0) {
        const result = await getInstructorBookingUrl(programInstructors[0].instructor_id);
        if (result) return result;
        resolvedInstructorId = programInstructors[0].instructor_id;
      }

      // 5. Check program-level coach assignment
      const { data: programCoaches } = await supabase
        .from("program_coaches")
        .select("coach_id")
        .eq("program_id", programId)
        .limit(1);

      if (programCoaches && programCoaches.length > 0) {
        const result = await getInstructorBookingUrl(programCoaches[0].coach_id);
        if (result) return result;
        resolvedInstructorId = programCoaches[0].coach_id;
      }

      // 6. Legacy fallback: Check calcom_event_type_mappings for module type
      const { data: mapping, error } = await supabase
        .from("calcom_event_type_mappings")
        .select("scheduling_url, calcom_event_type_id, calcom_event_type_slug")
        .eq("module_type", moduleType)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching calcom mapping:", error);
        return { schedulingUrl: null, eventTypeId: null, resolvedInstructorId };
      }

      // If mapping found with URL, use it directly
      if (mapping?.scheduling_url) {
        return {
          schedulingUrl: mapping.scheduling_url,
          eventTypeId: mapping.calcom_event_type_id,
          resolvedInstructorId,
        };
      }

      // If mapping found with ID but no URL, try to fetch URL from Cal.com API
      if (mapping?.calcom_event_type_id) {
        try {
          const { data: urlResult, error: urlError } = await supabase.functions.invoke(
            "calcom-get-booking-url",
            { body: { eventTypeId: mapping.calcom_event_type_id } },
          );

          // Check for successful response with booking URL
          if (!urlError && urlResult?.success !== false && urlResult?.bookingUrl) {
            return {
              schedulingUrl: urlResult.bookingUrl,
              eventTypeId: mapping.calcom_event_type_id,
              resolvedInstructorId,
            };
          }

          if (urlResult?.error === "event_type_not_found") {
            console.warn(
              `Cal.com event type ${mapping.calcom_event_type_id} not found in global mapping, falling back`,
            );
          } else {
            console.log("Cal.com API did not return booking URL, falling back to profile URLs");
          }
        } catch (err) {
          console.error("Error fetching booking URL from Cal.com:", err);
        }
      }

      return {
        schedulingUrl: null,
        eventTypeId: mapping?.calcom_event_type_id || null,
        resolvedInstructorId,
      };
    },
    enabled: enabled && !!moduleType,
  });
}
