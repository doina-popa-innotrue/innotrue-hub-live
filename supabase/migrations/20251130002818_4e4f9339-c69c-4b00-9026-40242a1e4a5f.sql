-- Create enum for decision status
CREATE TYPE decision_status AS ENUM ('upcoming', 'in_progress', 'made', 'cancelled');

-- Create enum for importance level
CREATE TYPE importance_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Create enum for urgency level
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');

-- Create enum for task status
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'blocked');

-- Create enum for task quadrant
CREATE TYPE task_quadrant AS ENUM ('important_urgent', 'important_not_urgent', 'not_important_urgent', 'not_important_not_urgent');

-- Create enum for task source type
CREATE TYPE task_source_type AS ENUM ('decision', 'goal', 'program', 'manual');

-- Create enum for comment item type
CREATE TYPE comment_item_type AS ENUM ('decision', 'task');

-- Create enum for comment author role
CREATE TYPE comment_author_role AS ENUM ('client', 'coach', 'admin');

-- Create decisions table
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status decision_status DEFAULT 'upcoming' NOT NULL,
  importance importance_level,
  urgency urgency_level,
  confidence_level INTEGER CHECK (confidence_level >= 0 AND confidence_level <= 100),
  expected_outcome TEXT,
  actual_outcome TEXT,
  decision_date DATE,
  buyers_model_notes TEXT,
  ten_ten_ten_notes TEXT,
  options_summary TEXT,
  values_alignment_notes TEXT,
  stop_rule_notes TEXT,
  internal_check_notes TEXT,
  yes_no_rule_notes TEXT,
  crossroads_notes TEXT,
  shared_with_coach BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create decision_options table
CREATE TABLE public.decision_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  emotion_notes TEXT,
  overall_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create decision_pros table
CREATE TABLE public.decision_pros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.decision_options(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  weight INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create decision_cons table
CREATE TABLE public.decision_cons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.decision_options(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  weight INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create decision_values table
CREATE TABLE public.decision_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  value_name TEXT NOT NULL,
  alignment_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create decision_reflections table
CREATE TABLE public.decision_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  what_went_well TEXT,
  what_did_not_go_well TEXT,
  unexpected_results TEXT,
  what_i_learned TEXT,
  satisfaction_score INTEGER CHECK (satisfaction_score >= 0 AND satisfaction_score <= 10),
  alignment_with_values_score INTEGER CHECK (alignment_with_values_score >= 0 AND alignment_with_values_score <= 10),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create decision_goals link table
CREATE TABLE public.decision_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  UNIQUE(decision_id, goal_id)
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo' NOT NULL,
  importance BOOLEAN,
  urgency BOOLEAN,
  quadrant task_quadrant,
  due_date DATE,
  source_type task_source_type,
  decision_id UUID REFERENCES public.decisions(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  shared_with_coach BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create client_coaches link table
CREATE TABLE public.client_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, coach_id)
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type comment_item_type NOT NULL,
  item_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role comment_author_role NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_pros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_cons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for decisions
CREATE POLICY "Users can view their own decisions"
  ON public.decisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view shared decisions from their clients"
  ON public.decisions FOR SELECT
  USING (
    shared_with_coach = true
    AND EXISTS (
      SELECT 1 FROM public.client_coaches
      WHERE client_coaches.client_id = decisions.user_id
      AND client_coaches.coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all decisions"
  ON public.decisions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own decisions"
  ON public.decisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decisions"
  ON public.decisions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decisions"
  ON public.decisions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for decision_options
CREATE POLICY "Users can view options for their decisions"
  ON public.decision_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_options.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert options for their decisions"
  ON public.decision_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_options.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update options for their decisions"
  ON public.decision_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_options.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete options for their decisions"
  ON public.decision_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_options.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- RLS Policies for decision_pros
CREATE POLICY "Users can view pros for their decisions"
  ON public.decision_pros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_pros.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert pros for their decisions"
  ON public.decision_pros FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_pros.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update pros for their decisions"
  ON public.decision_pros FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_pros.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete pros for their decisions"
  ON public.decision_pros FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_pros.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- RLS Policies for decision_cons
CREATE POLICY "Users can view cons for their decisions"
  ON public.decision_cons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_cons.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert cons for their decisions"
  ON public.decision_cons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_cons.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cons for their decisions"
  ON public.decision_cons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_cons.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cons for their decisions"
  ON public.decision_cons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_cons.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- RLS Policies for decision_values
CREATE POLICY "Users can view values for their decisions"
  ON public.decision_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_values.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert values for their decisions"
  ON public.decision_values FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_values.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update values for their decisions"
  ON public.decision_values FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_values.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete values for their decisions"
  ON public.decision_values FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_values.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- RLS Policies for decision_reflections
CREATE POLICY "Users can view reflections for their decisions"
  ON public.decision_reflections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_reflections.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert reflections for their decisions"
  ON public.decision_reflections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_reflections.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reflections for their decisions"
  ON public.decision_reflections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_reflections.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reflections for their decisions"
  ON public.decision_reflections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_reflections.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- RLS Policies for decision_goals
CREATE POLICY "Users can view goal links for their decisions"
  ON public.decision_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_goals.decision_id
      AND (decisions.user_id = auth.uid() OR decisions.shared_with_coach = true)
    )
  );

CREATE POLICY "Users can insert goal links for their decisions"
  ON public.decision_goals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_goals.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete goal links for their decisions"
  ON public.decision_goals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_goals.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- RLS Policies for tasks
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view shared tasks from their clients"
  ON public.tasks FOR SELECT
  USING (
    shared_with_coach = true
    AND EXISTS (
      SELECT 1 FROM public.client_coaches
      WHERE client_coaches.client_id = tasks.user_id
      AND client_coaches.coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all tasks"
  ON public.tasks FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for client_coaches
CREATE POLICY "Users can view their coach relationships"
  ON public.client_coaches FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = coach_id);

CREATE POLICY "Admins can manage coach relationships"
  ON public.client_coaches FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for comments
CREATE POLICY "Users can view comments on their items"
  ON public.comments FOR SELECT
  USING (
    (item_type = 'decision' AND EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = comments.item_id
      AND decisions.user_id = auth.uid()
    ))
    OR
    (item_type = 'task' AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = comments.item_id
      AND tasks.user_id = auth.uid()
    ))
  );

CREATE POLICY "Coaches can view comments on shared items"
  ON public.comments FOR SELECT
  USING (
    (item_type = 'decision' AND EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = comments.item_id
      AND decisions.shared_with_coach = true
      AND EXISTS (
        SELECT 1 FROM public.client_coaches
        WHERE client_coaches.client_id = decisions.user_id
        AND client_coaches.coach_id = auth.uid()
      )
    ))
    OR
    (item_type = 'task' AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = comments.item_id
      AND tasks.shared_with_coach = true
      AND EXISTS (
        SELECT 1 FROM public.client_coaches
        WHERE client_coaches.client_id = tasks.user_id
        AND client_coaches.coach_id = auth.uid()
      )
    ))
  );

CREATE POLICY "Admins can view all comments"
  ON public.comments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert comments on their items"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      (item_type = 'decision' AND EXISTS (
        SELECT 1 FROM public.decisions
        WHERE decisions.id = comments.item_id
        AND decisions.user_id = auth.uid()
      ))
      OR
      (item_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = comments.item_id
        AND tasks.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Coaches can insert comments on shared items"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      (item_type = 'decision' AND EXISTS (
        SELECT 1 FROM public.decisions
        WHERE decisions.id = comments.item_id
        AND decisions.shared_with_coach = true
        AND EXISTS (
          SELECT 1 FROM public.client_coaches
          WHERE client_coaches.client_id = decisions.user_id
          AND client_coaches.coach_id = auth.uid()
        )
      ))
      OR
      (item_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = comments.item_id
        AND tasks.shared_with_coach = true
        AND EXISTS (
          SELECT 1 FROM public.client_coaches
          WHERE client_coaches.client_id = tasks.user_id
          AND client_coaches.coach_id = auth.uid()
        )
      ))
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = author_id);

-- Create indexes for performance
CREATE INDEX idx_decisions_user_id ON public.decisions(user_id);
CREATE INDEX idx_decisions_status ON public.decisions(status);
CREATE INDEX idx_decisions_shared_with_coach ON public.decisions(shared_with_coach);
CREATE INDEX idx_decision_options_decision_id ON public.decision_options(decision_id);
CREATE INDEX idx_decision_pros_decision_id ON public.decision_pros(decision_id);
CREATE INDEX idx_decision_pros_option_id ON public.decision_pros(option_id);
CREATE INDEX idx_decision_cons_decision_id ON public.decision_cons(decision_id);
CREATE INDEX idx_decision_cons_option_id ON public.decision_cons(option_id);
CREATE INDEX idx_decision_values_decision_id ON public.decision_values(decision_id);
CREATE INDEX idx_decision_reflections_decision_id ON public.decision_reflections(decision_id);
CREATE INDEX idx_decision_goals_decision_id ON public.decision_goals(decision_id);
CREATE INDEX idx_decision_goals_goal_id ON public.decision_goals(goal_id);
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_quadrant ON public.tasks(quadrant);
CREATE INDEX idx_tasks_decision_id ON public.tasks(decision_id);
CREATE INDEX idx_tasks_goal_id ON public.tasks(goal_id);
CREATE INDEX idx_tasks_shared_with_coach ON public.tasks(shared_with_coach);
CREATE INDEX idx_client_coaches_client_id ON public.client_coaches(client_id);
CREATE INDEX idx_client_coaches_coach_id ON public.client_coaches(coach_id);
CREATE INDEX idx_comments_item_type_item_id ON public.comments(item_type, item_id);
CREATE INDEX idx_comments_author_id ON public.comments(author_id);

-- Create trigger to update updated_at on decisions
CREATE TRIGGER update_decisions_updated_at
  BEFORE UPDATE ON public.decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update updated_at on tasks
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();