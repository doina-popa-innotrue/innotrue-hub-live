-- Restructure enrollment_module_staff from separate instructor_id/coach_id columns
-- to unified staff_user_id + role pattern.
--
-- Reason: Support multiple instructors AND coaches per enrollment+module.
-- The old schema (UNIQUE enrollment_id, module_id) only allowed one row per combo,
-- meaning at most one instructor + one coach. The new schema allows many-to-many:
-- each row represents one staff member with a role, and the unique constraint
-- is (enrollment_id, module_id, staff_user_id) to prevent duplicate assignments.
--
-- This migration:
-- 1. Adds new columns (staff_user_id, role)
-- 2. Migrates existing data (each old row → 1 or 2 new rows)
-- 3. Drops old columns + constraints
-- 4. Adds new constraints + indexes
-- 5. Recreates RLS policies
-- 6. Updates dependent functions + policies on other tables

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: Add new columns (nullable initially for migration)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.enrollment_module_staff
  ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: Migrate existing data
-- Each row with instructor_id becomes a row with role='instructor'
-- Each row with coach_id becomes a row with role='coach'
-- If a row has BOTH, it produces two rows in the new schema
-- ═══════════════════════════════════════════════════════════════════

-- First, update rows that have an instructor_id (set the new columns on existing rows)
UPDATE public.enrollment_module_staff
SET staff_user_id = instructor_id, role = 'instructor'
WHERE instructor_id IS NOT NULL;

-- For rows that ALSO have a coach_id (both instructor and coach), insert a second row
INSERT INTO public.enrollment_module_staff (enrollment_id, module_id, staff_user_id, role)
SELECT enrollment_id, module_id, coach_id, 'coach'
FROM public.enrollment_module_staff
WHERE coach_id IS NOT NULL AND instructor_id IS NOT NULL;

-- For rows that ONLY have a coach_id (no instructor), update in place
UPDATE public.enrollment_module_staff
SET staff_user_id = coach_id, role = 'coach'
WHERE coach_id IS NOT NULL AND instructor_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 3: Drop dependent policies BEFORE dropping columns
-- (Postgres won't let us drop columns that policies reference)
-- ═══════════════════════════════════════════════════════════════════

-- Drop RLS policies on enrollment_module_staff that reference old columns
DROP POLICY IF EXISTS "Admins can manage enrollment_module_staff" ON public.enrollment_module_staff;
DROP POLICY IF EXISTS "Instructors can view their assignments" ON public.enrollment_module_staff;
DROP POLICY IF EXISTS "Coaches can view their assignments" ON public.enrollment_module_staff;
DROP POLICY IF EXISTS "Clients can view their enrollment staff" ON public.enrollment_module_staff;

-- Drop RLS policy on instructor_calcom_event_types that references old columns
DROP POLICY IF EXISTS "Clients can view event types for their assigned instructors" ON public.instructor_calcom_event_types;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 4: Drop old constraints, columns, and indexes
-- ═══════════════════════════════════════════════════════════════════

-- Drop old unique constraint (one row per enrollment+module)
ALTER TABLE public.enrollment_module_staff
  DROP CONSTRAINT IF EXISTS enrollment_module_staff_enrollment_id_module_id_key;

-- Drop old check constraint
ALTER TABLE public.enrollment_module_staff
  DROP CONSTRAINT IF EXISTS at_least_one_staff;

-- Drop old FK constraints (must be dropped before columns)
ALTER TABLE public.enrollment_module_staff
  DROP CONSTRAINT IF EXISTS enrollment_module_staff_instructor_id_fkey;
ALTER TABLE public.enrollment_module_staff
  DROP CONSTRAINT IF EXISTS enrollment_module_staff_coach_id_fkey;

-- Drop old indexes
DROP INDEX IF EXISTS idx_enrollment_module_staff_instructor;
DROP INDEX IF EXISTS idx_enrollment_module_staff_coach;

-- Drop old columns
ALTER TABLE public.enrollment_module_staff
  DROP COLUMN IF EXISTS instructor_id,
  DROP COLUMN IF EXISTS coach_id;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 5: Make new columns NOT NULL and add constraints
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.enrollment_module_staff
  ALTER COLUMN staff_user_id SET NOT NULL,
  ALTER COLUMN role SET NOT NULL;

-- One staff member can only be assigned once per enrollment+module
ALTER TABLE public.enrollment_module_staff
  ADD CONSTRAINT enrollment_module_staff_unique_assignment
    UNIQUE (enrollment_id, module_id, staff_user_id);

-- Role must be 'instructor' or 'coach'
ALTER TABLE public.enrollment_module_staff
  ADD CONSTRAINT enrollment_module_staff_valid_role
    CHECK (role IN ('instructor', 'coach'));

-- ═══════════════════════════════════════════════════════════════════
-- STEP 6: Create new indexes
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_enrollment_module_staff_staff_user
  ON public.enrollment_module_staff(staff_user_id);

CREATE INDEX IF NOT EXISTS idx_enrollment_module_staff_role
  ON public.enrollment_module_staff(role);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 7: Recreate RLS policies for enrollment_module_staff
-- (Old policies were dropped in Step 3 before column removal)
-- ═══════════════════════════════════════════════════════════════════

-- Admins: full access
CREATE POLICY "Admins can manage enrollment_module_staff"
ON public.enrollment_module_staff
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff can view their own assignments (instructors and coaches use the same column now)
CREATE POLICY "Staff can view their assignments"
ON public.enrollment_module_staff
FOR SELECT
TO authenticated
USING (staff_user_id = auth.uid());

-- Staff can update/transfer their own assignments
CREATE POLICY "Staff can update their assignments"
ON public.enrollment_module_staff
FOR UPDATE
TO authenticated
USING (staff_user_id = auth.uid())
WITH CHECK (true);

-- Staff can insert assignments (for transfers — assigning to a colleague)
CREATE POLICY "Staff can insert assignments"
ON public.enrollment_module_staff
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'instructor') OR public.has_role(auth.uid(), 'coach')
);

-- Clients can view their enrollment staff assignments
CREATE POLICY "Clients can view their enrollment staff"
ON public.enrollment_module_staff
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_enrollments ce
    WHERE ce.id = enrollment_id
    AND ce.client_user_id = auth.uid()
  )
);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 8: Update client_can_view_staff_profile function
-- (used by profiles RLS policy)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.client_can_view_staff_profile(_client_id uuid, _staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Program instructor
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_instructors pi ON pi.program_id = ce.program_id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND pi.instructor_id = _staff_id
    )
    OR
    -- Program coach
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_coaches pc ON pc.program_id = ce.program_id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND pc.coach_id = _staff_id
    )
    OR
    -- Module instructor
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_modules pm ON pm.program_id = ce.program_id
      JOIN module_instructors mi ON mi.module_id = pm.id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND mi.instructor_id = _staff_id
    )
    OR
    -- Module coach
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_modules pm ON pm.program_id = ce.program_id
      JOIN module_coaches mc ON mc.module_id = pm.id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND mc.coach_id = _staff_id
    )
    OR
    -- Enrollment-level staff assignment (unified column)
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN enrollment_module_staff ems ON ems.enrollment_id = ce.id
      WHERE ce.client_user_id = _client_id
        AND ce.status IN ('active', 'paused', 'completed')
        AND ems.staff_user_id = _staff_id
    )
$$;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 9: Recreate instructor_calcom_event_types RLS policy
-- (Old policy was dropped in Step 3 before column removal)
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY "Clients can view event types for their assigned instructors"
ON public.instructor_calcom_event_types
FOR SELECT
TO authenticated
USING (
    -- Can view if the instructor is assigned at enrollment level
    EXISTS (
        SELECT 1 FROM public.enrollment_module_staff ems
        JOIN public.client_enrollments ce ON ce.id = ems.enrollment_id
        WHERE ce.client_user_id = auth.uid()
        AND ems.staff_user_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Or if instructor is assigned at module level for their program
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_modules pm ON pm.program_id = ce.program_id
        JOIN public.module_instructors mi ON mi.module_id = pm.id
        WHERE ce.client_user_id = auth.uid()
        AND mi.instructor_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Or if instructor is assigned at program level
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_instructors pi ON pi.program_id = ce.program_id
        WHERE ce.client_user_id = auth.uid()
        AND pi.instructor_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Coaches at module level
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_modules pm ON pm.program_id = ce.program_id
        JOIN public.module_coaches mc ON mc.module_id = pm.id
        WHERE ce.client_user_id = auth.uid()
        AND mc.coach_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Coaches at program level
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_coaches pc ON pc.program_id = ce.program_id
        WHERE ce.client_user_id = auth.uid()
        AND pc.coach_id = instructor_calcom_event_types.instructor_id
    )
);

COMMIT;
