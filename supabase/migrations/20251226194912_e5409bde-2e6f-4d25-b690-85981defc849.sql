-- Allow users to insert their own Lucid mapping
CREATE POLICY "Users can insert own lucid mapping"
ON public.lucid_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own Lucid mapping
CREATE POLICY "Users can update own lucid mapping"
ON public.lucid_users
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own Lucid mapping
CREATE POLICY "Users can delete own lucid mapping"
ON public.lucid_users
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);