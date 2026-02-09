-- Clean up redundant RLS policies on client_staff_notes
-- Drop all existing policies and create clean consolidated ones

-- Drop existing policies on client_staff_notes
DROP POLICY IF EXISTS "Admins can delete any client staff note" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Admins can insert client staff notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Admins can update any client staff note" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Admins can view all client staff notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Authors can update own notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can add client notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can delete notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can delete own notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can delete their own client notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can insert their own client notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can update own notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can update their own client notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can view client notes with privacy control" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can view their own client notes" ON public.client_staff_notes;

-- Create clean consolidated policies

-- SELECT: Admins see all; Authors see own; Staff with relationship see non-private notes
CREATE POLICY "client_staff_notes_select_policy"
ON public.client_staff_notes
FOR SELECT
TO authenticated
USING (
  -- Admins can view all notes
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Authors can view their own notes
  author_id = auth.uid()
  OR
  -- Staff with client relationship can view non-private notes
  (
    is_private = false 
    AND public.staff_has_client_relationship(auth.uid(), client_user_id)
  )
);

-- INSERT: Staff can insert notes for clients they have a relationship with
CREATE POLICY "client_staff_notes_insert_policy"
ON public.client_staff_notes
FOR INSERT
TO authenticated
WITH CHECK (
  -- Must set themselves as author
  author_id = auth.uid()
  AND
  (
    -- Admins can add notes for any client
    public.has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Staff can add notes for their assigned clients
    public.staff_has_client_relationship(auth.uid(), client_user_id)
  )
);

-- UPDATE: Only admins and original author can update notes
CREATE POLICY "client_staff_notes_update_policy"
ON public.client_staff_notes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  author_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  author_id = auth.uid()
);

-- DELETE: Only admins and original author can delete notes
CREATE POLICY "client_staff_notes_delete_policy"
ON public.client_staff_notes
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR
  author_id = auth.uid()
);

-- Also clean up attachments policies for consistency
DROP POLICY IF EXISTS "Users can delete attachments for their notes" ON public.client_staff_note_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for their notes" ON public.client_staff_note_attachments;
DROP POLICY IF EXISTS "Users can view attachments for accessible notes" ON public.client_staff_note_attachments;

-- Attachments inherit access from parent note
CREATE POLICY "client_staff_note_attachments_select_policy"
ON public.client_staff_note_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = client_staff_note_attachments.note_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR n.author_id = auth.uid()
      OR (n.is_private = false AND public.staff_has_client_relationship(auth.uid(), n.client_user_id))
    )
  )
);

CREATE POLICY "client_staff_note_attachments_insert_policy"
ON public.client_staff_note_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = client_staff_note_attachments.note_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR n.author_id = auth.uid()
    )
  )
);

CREATE POLICY "client_staff_note_attachments_update_policy"
ON public.client_staff_note_attachments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = client_staff_note_attachments.note_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR n.author_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = client_staff_note_attachments.note_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR n.author_id = auth.uid()
    )
  )
);

CREATE POLICY "client_staff_note_attachments_delete_policy"
ON public.client_staff_note_attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = client_staff_note_attachments.note_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR n.author_id = auth.uid()
    )
  )
);