-- Add is_private column to control note-level access
ALTER TABLE public.client_staff_notes 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.client_staff_notes.is_private IS 'When true, only the author and admins can view this note';

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Staff can view client notes" ON public.client_staff_notes;

-- Create new SELECT policy with note-level access control
-- Admins can view all notes
-- Authors can view their own notes
-- Staff can only view non-private notes for their related clients
CREATE POLICY "Staff can view client notes with privacy control"
ON public.client_staff_notes
FOR SELECT
USING (
  -- Admins can view all notes
  public.has_role(auth.uid(), 'admin')
  OR 
  -- Authors can always view their own notes
  auth.uid() = author_id
  OR 
  -- Staff can view non-private notes for related clients
  (
    is_private = false 
    AND public.staff_has_client_relationship(auth.uid(), client_user_id)
  )
);

-- Update existing UPDATE policy to ensure only authors can update their own notes
DROP POLICY IF EXISTS "Staff can update own notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can update their own notes" ON public.client_staff_notes;

CREATE POLICY "Staff can update own notes"
ON public.client_staff_notes
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = author_id
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = author_id
);

-- Update existing DELETE policy to ensure only authors can delete their own notes
DROP POLICY IF EXISTS "Staff can delete own notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can delete their own notes" ON public.client_staff_notes;

CREATE POLICY "Staff can delete own notes"
ON public.client_staff_notes
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = author_id
);