-- 1. Make shared_with_coach NOT NULL with default false to prevent NULL confusion
ALTER TABLE public.decisions 
ALTER COLUMN shared_with_coach SET NOT NULL,
ALTER COLUMN shared_with_coach SET DEFAULT false;

-- Update any existing NULL values to false
UPDATE public.decisions SET shared_with_coach = false WHERE shared_with_coach IS NULL;

-- 2. Create audit table for decision sharing changes
CREATE TABLE public.decision_sharing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- The decision owner
  changed_by UUID NOT NULL, -- Who made the change (should always be the owner)
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS on audit table
ALTER TABLE public.decision_sharing_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit table - only admins and decision owners can view
CREATE POLICY "Admins can view all sharing audit logs"
  ON public.decision_sharing_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view audit logs for their own decisions"
  ON public.decision_sharing_audit FOR SELECT
  USING (auth.uid() = user_id);

-- No direct inserts/updates/deletes allowed - only via trigger
CREATE POLICY "No direct modifications to audit logs"
  ON public.decision_sharing_audit FOR ALL
  USING (false)
  WITH CHECK (false);

-- 3. Create trigger function to log sharing changes
CREATE OR REPLACE FUNCTION public.log_decision_sharing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if shared_with_coach actually changed
  IF OLD.shared_with_coach IS DISTINCT FROM NEW.shared_with_coach THEN
    INSERT INTO public.decision_sharing_audit (
      decision_id,
      user_id,
      changed_by,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      NEW.user_id,
      auth.uid(),
      COALESCE(OLD.shared_with_coach, false),
      NEW.shared_with_coach
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create the trigger
CREATE TRIGGER decision_sharing_audit_trigger
  AFTER UPDATE ON public.decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_decision_sharing_change();

-- 5. Create index for efficient audit queries
CREATE INDEX idx_decision_sharing_audit_decision ON public.decision_sharing_audit(decision_id);
CREATE INDEX idx_decision_sharing_audit_user ON public.decision_sharing_audit(user_id);
CREATE INDEX idx_decision_sharing_audit_changed_at ON public.decision_sharing_audit(changed_at DESC);

-- 6. Do the same for tasks table which also has shared_with_coach
ALTER TABLE public.tasks 
ALTER COLUMN shared_with_coach SET NOT NULL,
ALTER COLUMN shared_with_coach SET DEFAULT false;

UPDATE public.tasks SET shared_with_coach = false WHERE shared_with_coach IS NULL;

-- Create audit table for task sharing changes
CREATE TABLE public.task_sharing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_sharing_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all task sharing audit logs"
  ON public.task_sharing_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view audit logs for their own tasks"
  ON public.task_sharing_audit FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "No direct modifications to task audit logs"
  ON public.task_sharing_audit FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.log_task_sharing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.shared_with_coach IS DISTINCT FROM NEW.shared_with_coach THEN
    INSERT INTO public.task_sharing_audit (
      task_id,
      user_id,
      changed_by,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      NEW.user_id,
      auth.uid(),
      COALESCE(OLD.shared_with_coach, false),
      NEW.shared_with_coach
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_sharing_audit_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_sharing_change();

CREATE INDEX idx_task_sharing_audit_task ON public.task_sharing_audit(task_id);
CREATE INDEX idx_task_sharing_audit_user ON public.task_sharing_audit(user_id);