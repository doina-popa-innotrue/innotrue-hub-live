-- Add allow_repeat_enrollment flag to programs
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS allow_repeat_enrollment BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.programs.allow_repeat_enrollment IS 'When true, clients can enroll in this program multiple times (e.g., for mock review boards, practice programs)';

-- Drop the existing unique constraint if it exists (need to find its name first)
-- The constraint prevents duplicate enrollments per program per user
DO $$
BEGIN
  -- Try to drop common constraint names
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_enrollments_client_user_id_program_id_key') THEN
    ALTER TABLE public.client_enrollments DROP CONSTRAINT client_enrollments_client_user_id_program_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_client_program_enrollment') THEN
    ALTER TABLE public.client_enrollments DROP CONSTRAINT unique_client_program_enrollment;
  END IF;
END $$;

-- Drop any unique index that might exist
DROP INDEX IF EXISTS client_enrollments_client_user_id_program_id_key;
DROP INDEX IF EXISTS unique_client_program_enrollment;
DROP INDEX IF EXISTS idx_unique_active_enrollment;

-- Create a function to check enrollment uniqueness based on program settings
CREATE OR REPLACE FUNCTION check_repeat_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  allow_repeat BOOLEAN;
  existing_count INTEGER;
BEGIN
  -- Get the program's allow_repeat_enrollment setting
  SELECT p.allow_repeat_enrollment INTO allow_repeat
  FROM programs p
  WHERE p.id = NEW.program_id;

  -- If repeat enrollment is not allowed, check for existing active enrollment
  IF NOT COALESCE(allow_repeat, false) THEN
    SELECT COUNT(*) INTO existing_count
    FROM client_enrollments ce
    WHERE ce.client_user_id = NEW.client_user_id
      AND ce.program_id = NEW.program_id
      AND ce.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Duplicate enrollment not allowed for this program'
        USING ERRCODE = '23505'; -- unique_violation error code
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for enrollment validation
DROP TRIGGER IF EXISTS check_repeat_enrollment_trigger ON client_enrollments;
CREATE TRIGGER check_repeat_enrollment_trigger
  BEFORE INSERT ON client_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION check_repeat_enrollment();

-- Add enrollment_number column to track which attempt this is
ALTER TABLE public.client_enrollments 
ADD COLUMN IF NOT EXISTS enrollment_number INTEGER DEFAULT 1;

COMMENT ON COLUMN public.client_enrollments.enrollment_number IS 'Which enrollment attempt this is for the user in this program (1 = first, 2 = second, etc.)';

-- Create function to auto-set enrollment_number on insert
CREATE OR REPLACE FUNCTION set_enrollment_number()
RETURNS TRIGGER AS $$
DECLARE
  max_number INTEGER;
BEGIN
  -- Get the highest enrollment number for this user+program
  SELECT COALESCE(MAX(enrollment_number), 0) INTO max_number
  FROM client_enrollments
  WHERE client_user_id = NEW.client_user_id
    AND program_id = NEW.program_id;
  
  NEW.enrollment_number := max_number + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-set enrollment number
DROP TRIGGER IF EXISTS set_enrollment_number_trigger ON client_enrollments;
CREATE TRIGGER set_enrollment_number_trigger
  BEFORE INSERT ON client_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION set_enrollment_number();