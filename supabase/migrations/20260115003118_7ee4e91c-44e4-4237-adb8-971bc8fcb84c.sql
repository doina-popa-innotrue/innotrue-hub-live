-- Add author_id to development_items to track who created the item
-- This allows instructors to create resources for clients during evaluations
ALTER TABLE public.development_items 
ADD COLUMN author_id UUID REFERENCES auth.users(id);

-- Set existing items to have author_id = user_id (self-created)
UPDATE public.development_items SET author_id = user_id WHERE author_id IS NULL;

-- Make author_id NOT NULL going forward (but nullable for migration)
-- We'll leave it nullable to allow existing code to work

-- Add index for efficient lookups
CREATE INDEX idx_development_items_author_id ON public.development_items(author_id);

-- Update RLS: Users can still view/manage their own items (where user_id = auth.uid())
-- Instructors can create items for clients they coach
CREATE POLICY "Instructors can create development items for clients"
  ON public.development_items FOR INSERT
  WITH CHECK (
    -- Either creating for yourself
    user_id = auth.uid()
    OR
    -- Or you're an instructor/coach for this client
    EXISTS (
      SELECT 1 FROM public.client_coaches cc
      WHERE cc.client_id = user_id AND cc.coach_id = auth.uid()
    )
    OR
    -- Or you're an instructor for a program the client is enrolled in
    EXISTS (
      SELECT 1 FROM public.program_instructors pi
      JOIN public.client_enrollments ce ON ce.program_id = pi.program_id
      WHERE pi.instructor_id = auth.uid() AND ce.client_user_id = user_id
    )
  );

-- Instructors can update items they authored for their clients
CREATE POLICY "Instructors can update items they authored for clients"
  ON public.development_items FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.client_coaches cc
      WHERE cc.client_id = user_id AND cc.coach_id = auth.uid()
    ))
  );

-- Instructors can delete items they authored for their clients
CREATE POLICY "Instructors can delete items they authored for clients"
  ON public.development_items FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.client_coaches cc
      WHERE cc.client_id = user_id AND cc.coach_id = auth.uid()
    ))
  );

-- Update junction table policies to allow instructors to link items they create for clients
DROP POLICY IF EXISTS "Users can create their own snapshot links" ON public.development_item_snapshot_links;
CREATE POLICY "Users and instructors can create snapshot links"
  ON public.development_item_snapshot_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id 
      AND (di.user_id = auth.uid() OR di.author_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create their own question links" ON public.development_item_question_links;
CREATE POLICY "Users and instructors can create question links"
  ON public.development_item_question_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id 
      AND (di.user_id = auth.uid() OR di.author_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create their own domain links" ON public.development_item_domain_links;
CREATE POLICY "Users and instructors can create domain links"
  ON public.development_item_domain_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id 
      AND (di.user_id = auth.uid() OR di.author_id = auth.uid())
    )
  );