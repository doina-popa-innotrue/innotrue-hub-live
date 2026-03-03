-- Fix: UPDATE and DELETE policies on development_items only checked client_coaches,
-- so instructors (in client_instructors but not client_coaches) could not update
-- or delete items they authored for clients. Align with SELECT policies which
-- already check both client_coaches and client_instructors.

DROP POLICY IF EXISTS "Instructors can update items they authored for clients" ON public.development_items;
CREATE POLICY "Instructors can update items they authored for clients"
  ON public.development_items FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.client_coaches cc
        WHERE cc.client_id = development_items.user_id AND cc.coach_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.client_instructors ci
        WHERE ci.client_id = development_items.user_id AND ci.instructor_id = auth.uid()
      )
    ))
  );

DROP POLICY IF EXISTS "Instructors can delete items they authored for clients" ON public.development_items;
CREATE POLICY "Instructors can delete items they authored for clients"
  ON public.development_items FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    (author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.client_coaches cc
        WHERE cc.client_id = development_items.user_id AND cc.coach_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.client_instructors ci
        WHERE ci.client_id = development_items.user_id AND ci.instructor_id = auth.uid()
      )
    ))
  );
