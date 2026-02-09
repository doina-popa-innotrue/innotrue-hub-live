-- Create decision journal entries table
CREATE TABLE IF NOT EXISTS public.decision_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decision_journal_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for decision_journal_entries
CREATE POLICY "Users can view journal entries for their decisions"
  ON public.decision_journal_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_journal_entries.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert journal entries for their decisions"
  ON public.decision_journal_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_journal_entries.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own journal entries"
  ON public.decision_journal_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal entries"
  ON public.decision_journal_entries
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view journal entries for shared decisions"
  ON public.decision_journal_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_journal_entries.decision_id
      AND decisions.shared_with_coach = true
      AND EXISTS (
        SELECT 1 FROM public.client_coaches
        WHERE client_coaches.client_id = decisions.user_id
        AND client_coaches.coach_id = auth.uid()
      )
    )
  );

-- Create indexes
CREATE INDEX idx_decision_journal_entries_decision_id ON public.decision_journal_entries(decision_id);
CREATE INDEX idx_decision_journal_entries_user_id ON public.decision_journal_entries(user_id);
CREATE INDEX idx_decision_journal_entries_entry_date ON public.decision_journal_entries(entry_date);

-- Add updated_at trigger
CREATE TRIGGER update_decision_journal_entries_updated_at
  BEFORE UPDATE ON public.decision_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();