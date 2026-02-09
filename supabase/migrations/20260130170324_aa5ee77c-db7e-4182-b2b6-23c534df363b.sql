-- Add Cal.com booking tracking columns to module_sessions
ALTER TABLE public.module_sessions 
ADD COLUMN IF NOT EXISTS calcom_booking_id text,
ADD COLUMN IF NOT EXISTS calcom_booking_uid text,
ADD COLUMN IF NOT EXISTS calcom_event_type_id integer,
ADD COLUMN IF NOT EXISTS calcom_event_type_slug text,
ADD COLUMN IF NOT EXISTS calcom_reschedule_uid text,
ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'manual';

-- Add Cal.com booking tracking columns to group_sessions
ALTER TABLE public.group_sessions 
ADD COLUMN IF NOT EXISTS calcom_booking_id text,
ADD COLUMN IF NOT EXISTS calcom_booking_uid text,
ADD COLUMN IF NOT EXISTS calcom_event_type_id integer,
ADD COLUMN IF NOT EXISTS calcom_event_type_slug text,
ADD COLUMN IF NOT EXISTS calcom_reschedule_uid text,
ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'manual';

-- Create index for faster lookups by Cal.com booking ID
CREATE INDEX IF NOT EXISTS idx_module_sessions_calcom_booking_uid ON public.module_sessions(calcom_booking_uid);
CREATE INDEX IF NOT EXISTS idx_group_sessions_calcom_booking_uid ON public.group_sessions(calcom_booking_uid);

-- Create a table to log Cal.com webhook events for debugging/auditing
CREATE TABLE IF NOT EXISTS public.calcom_webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calcom_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
ON public.calcom_webhook_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create calcom_event_type_mappings table to map Cal.com event types to Hub session types
CREATE TABLE IF NOT EXISTS public.calcom_event_type_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calcom_event_type_id integer NOT NULL UNIQUE,
  calcom_event_type_slug text,
  calcom_event_type_name text,
  session_target text NOT NULL CHECK (session_target IN ('module_session', 'group_session')),
  default_program_id uuid REFERENCES public.programs(id),
  default_group_id uuid REFERENCES public.groups(id),
  default_module_id uuid REFERENCES public.program_modules(id),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calcom_event_type_mappings ENABLE ROW LEVEL SECURITY;

-- Admins can manage mappings
CREATE POLICY "Admins can manage event type mappings"
ON public.calcom_event_type_mappings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);