
-- Create notification categories table
CREATE TABLE public.notification_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'bell',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notification types table
CREATE TABLE public.notification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES public.notification_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'bell',
  is_critical BOOLEAN DEFAULT false, -- Critical notifications cannot be disabled
  default_email_enabled BOOLEAN DEFAULT true,
  default_in_app_enabled BOOLEAN DEFAULT true,
  email_template_key TEXT, -- Links to email template
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user notification preferences table
CREATE TABLE public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type_id UUID REFERENCES public.notification_types(id) ON DELETE CASCADE NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_type_id)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type_id UUID REFERENCES public.notification_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create email queue for reliable delivery
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  template_key TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add calendar sync fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS calendar_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX idx_notification_categories_active ON public.notification_categories(is_active, order_index);
CREATE INDEX idx_notification_types_category ON public.notification_types(category_id);
CREATE INDEX idx_notification_types_active ON public.notification_types(is_active, order_index);
CREATE INDEX idx_notification_types_key ON public.notification_types(key);
CREATE INDEX idx_user_notification_prefs_user ON public.user_notification_preferences(user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON public.notifications(notification_type_id);
CREATE INDEX idx_email_queue_status ON public.email_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_profiles_calendar_token ON public.profiles(calendar_token) WHERE calendar_token IS NOT NULL;

-- Enable RLS
ALTER TABLE public.notification_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_categories (read-only for users, admin can manage)
CREATE POLICY "Anyone can view active notification categories"
ON public.notification_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage notification categories"
ON public.notification_categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for notification_types (read-only for users, admin can manage)
CREATE POLICY "Anyone can view active notification types"
ON public.notification_types FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage notification types"
ON public.notification_types FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_notification_preferences
CREATE POLICY "Users can view their own preferences"
ON public.user_notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.user_notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
ON public.user_notification_preferences FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- RLS Policies for email_queue (service role only)
CREATE POLICY "Service role can manage email queue"
ON public.email_queue FOR ALL
USING (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to get user's effective notification preferences
-- Returns the user's preference if set, otherwise the type's default
CREATE OR REPLACE FUNCTION public.get_user_notification_preference(
  p_user_id UUID,
  p_notification_type_key TEXT
)
RETURNS TABLE(
  email_enabled BOOLEAN,
  in_app_enabled BOOLEAN,
  is_critical BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN nt.is_critical THEN true
      WHEN unp.id IS NOT NULL THEN unp.email_enabled
      ELSE nt.default_email_enabled
    END as email_enabled,
    CASE 
      WHEN nt.is_critical THEN true
      WHEN unp.id IS NOT NULL THEN unp.in_app_enabled
      ELSE nt.default_in_app_enabled
    END as in_app_enabled,
    nt.is_critical
  FROM public.notification_types nt
  LEFT JOIN public.user_notification_preferences unp 
    ON unp.notification_type_id = nt.id AND unp.user_id = p_user_id
  WHERE nt.key = p_notification_type_key AND nt.is_active = true;
END;
$$;

-- Function to create a notification with preference checking
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type_key TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_type_id UUID;
  v_prefs RECORD;
  v_email TEXT;
  v_name TEXT;
  v_template_key TEXT;
BEGIN
  -- Get notification type
  SELECT id, email_template_key INTO v_type_id, v_template_key
  FROM public.notification_types
  WHERE key = p_type_key AND is_active = true;
  
  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type_key;
  END IF;
  
  -- Get user preferences
  SELECT * INTO v_prefs 
  FROM public.get_user_notification_preference(p_user_id, p_type_key);
  
  -- Only create in-app notification if enabled
  IF v_prefs.in_app_enabled THEN
    INSERT INTO public.notifications (user_id, notification_type_id, title, message, link, metadata)
    VALUES (p_user_id, v_type_id, p_title, p_message, p_link, p_metadata)
    RETURNING id INTO v_notification_id;
  END IF;
  
  -- Queue email if enabled and template exists
  IF v_prefs.email_enabled AND v_template_key IS NOT NULL THEN
    -- Get user email
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    SELECT full_name INTO v_name FROM public.profiles WHERE id = p_user_id;
    
    IF v_email IS NOT NULL THEN
      INSERT INTO public.email_queue (
        notification_id, 
        recipient_email, 
        recipient_name,
        template_key, 
        template_data
      )
      VALUES (
        v_notification_id,
        v_email,
        v_name,
        v_template_key,
        jsonb_build_object(
          'title', p_title,
          'message', p_message,
          'link', p_link,
          'user_name', v_name
        ) || p_metadata
      );
    END IF;
  END IF;
  
  RETURN v_notification_id;
END;
$$;

-- Insert default notification categories
INSERT INTO public.notification_categories (key, name, description, icon, order_index) VALUES
('programs', 'Programs & Modules', 'Notifications about your enrolled programs and module updates', 'graduation-cap', 1),
('sessions', 'Sessions & Meetings', 'Reminders and updates about scheduled sessions', 'calendar', 2),
('assignments', 'Assignments & Feedback', 'Assignment submissions, grades, and instructor feedback', 'file-text', 3),
('goals', 'Goals & Progress', 'Goal updates, milestone achievements, and progress reminders', 'target', 4),
('decisions', 'Decision Toolkit', 'Decision reminders, follow-ups, and outcome tracking', 'scale', 5),
('credits', 'Credits & Billing', 'Credit balance updates, purchases, and billing notifications', 'credit-card', 6),
('groups', 'Groups & Collaboration', 'Group activities, discussions, and team updates', 'users', 7),
('system', 'System & Account', 'Account updates, security alerts, and platform announcements', 'settings', 8);

-- Insert default notification types
INSERT INTO public.notification_types (key, category_id, name, description, icon, is_critical, email_template_key, order_index) VALUES
-- Programs & Modules
('program_enrolled', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Program Enrollment', 'When you are enrolled in a new program', 'book-open', false, 'program_enrollment', 1),
('module_unlocked', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Module Unlocked', 'When a new module becomes available', 'unlock', false, 'module_unlocked', 2),
('module_completed', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Module Completed', 'Confirmation when you complete a module', 'check-circle', false, null, 3),
('program_completed', (SELECT id FROM notification_categories WHERE key = 'programs'), 'Program Completed', 'When you complete a program', 'award', false, 'program_completion', 4),

-- Sessions & Meetings
('session_scheduled', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Scheduled', 'When a new session is scheduled for you', 'calendar-plus', false, 'session_scheduled', 1),
('session_reminder', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Reminder', 'Reminders before upcoming sessions', 'bell', false, 'session_reminder', 2),
('session_cancelled', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Cancelled', 'When a scheduled session is cancelled', 'calendar-x', false, 'session_cancelled', 3),
('session_rescheduled', (SELECT id FROM notification_categories WHERE key = 'sessions'), 'Session Rescheduled', 'When a session time is changed', 'calendar-clock', false, 'session_rescheduled', 4),

-- Assignments & Feedback
('assignment_available', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'New Assignment', 'When a new assignment is available', 'file-plus', false, 'assignment_available', 1),
('assignment_due_soon', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'Assignment Due Soon', 'Reminder before assignment deadline', 'clock', false, 'assignment_due_reminder', 2),
('assignment_graded', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'Assignment Graded', 'When your assignment receives feedback', 'check-square', false, 'assignment_graded', 3),
('feedback_received', (SELECT id FROM notification_categories WHERE key = 'assignments'), 'Feedback Received', 'When instructor provides feedback', 'message-square', false, 'feedback_received', 4),

-- Goals & Progress
('goal_reminder', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Goal Check-in Reminder', 'Periodic reminders to update goal progress', 'target', false, null, 1),
('milestone_achieved', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Milestone Achieved', 'When you complete a goal milestone', 'flag', false, null, 2),
('goal_shared', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Goal Shared With You', 'When someone shares a goal with you', 'share', false, null, 3),
('goal_comment', (SELECT id FROM notification_categories WHERE key = 'goals'), 'Goal Comment', 'When someone comments on your shared goal', 'message-circle', false, null, 4),

-- Decision Toolkit
('decision_reminder', (SELECT id FROM notification_categories WHERE key = 'decisions'), 'Decision Follow-up', 'Reminders to follow up on pending decisions', 'clock', false, 'decision_reminder', 1),
('decision_outcome_due', (SELECT id FROM notification_categories WHERE key = 'decisions'), 'Outcome Review Due', 'Time to review a decision outcome', 'clipboard-check', false, null, 2),

-- Credits & Billing
('credits_low', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Low Credit Balance', 'When your credit balance is running low', 'alert-triangle', false, 'credits_low', 1),
('credits_added', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Credits Added', 'When credits are added to your account', 'plus-circle', false, null, 2),
('credits_expiring', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Credits Expiring Soon', 'Warning before credits expire', 'calendar-clock', false, 'credits_expiring', 3),
('payment_received', (SELECT id FROM notification_categories WHERE key = 'credits'), 'Payment Confirmation', 'Confirmation of payment received', 'check-circle', false, 'payment_confirmation', 4),

-- Groups & Collaboration
('group_joined', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Added to Group', 'When you are added to a group', 'user-plus', false, null, 1),
('group_task_assigned', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Task Assigned', 'When a group task is assigned to you', 'list-todo', false, null, 2),
('group_session_scheduled', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Group Session Scheduled', 'When a group session is scheduled', 'users', false, 'group_session_scheduled', 3),
('group_message', (SELECT id FROM notification_categories WHERE key = 'groups'), 'Group Activity', 'New activity in your groups', 'message-square', false, null, 4),

-- System & Account (some critical)
('security_alert', (SELECT id FROM notification_categories WHERE key = 'system'), 'Security Alert', 'Important security notifications', 'shield-alert', true, 'security_alert', 1),
('account_updated', (SELECT id FROM notification_categories WHERE key = 'system'), 'Account Updated', 'When your account settings change', 'user-cog', true, null, 2),
('terms_updated', (SELECT id FROM notification_categories WHERE key = 'system'), 'Terms Updated', 'When platform terms are updated', 'file-text', true, 'terms_updated', 3),
('platform_announcement', (SELECT id FROM notification_categories WHERE key = 'system'), 'Platform Announcement', 'Important platform announcements', 'megaphone', false, null, 4),
('welcome', (SELECT id FROM notification_categories WHERE key = 'system'), 'Welcome Message', 'Welcome message for new users', 'hand-wave', false, 'welcome', 5);

-- Update timestamp triggers
CREATE TRIGGER update_notification_categories_updated_at
  BEFORE UPDATE ON public.notification_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_types_updated_at
  BEFORE UPDATE ON public.notification_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
