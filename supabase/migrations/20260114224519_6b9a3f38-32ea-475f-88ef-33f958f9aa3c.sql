-- Add missing DELETE policy for generated_prompts
CREATE POLICY "Users can delete their own prompts"
  ON public.generated_prompts FOR DELETE
  USING (auth.uid() = user_id);