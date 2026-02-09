-- Create table for ActiveCampaign sync configurations
CREATE TABLE public.activecampaign_sync_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'wheel_of_life_completed', 'assessment_completed', 'module_completed', 'badge_earned', etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- What to send to AC
  sync_type TEXT NOT NULL, -- 'custom_field', 'tag', 'automation', 'deal'
  ac_target_id TEXT, -- AC custom field ID, tag name, automation ID, or deal pipeline ID
  ac_target_name TEXT, -- Human-readable name for display
  
  -- Field mapping (JSON for flexibility)
  field_mappings JSONB DEFAULT '{}', -- Maps platform fields to AC fields
  
  -- Filters (optional)
  filter_conditions JSONB DEFAULT '{}', -- e.g., {"program_id": "abc", "min_score": 7}
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create table for sync logs
CREATE TABLE public.activecampaign_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES public.activecampaign_sync_configs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  ac_contact_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  ac_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activecampaign_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activecampaign_sync_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage sync configs
CREATE POLICY "Admins can manage sync configs"
  ON public.activecampaign_sync_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
  ON public.activecampaign_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Allow edge functions to insert logs
CREATE POLICY "Service role can insert sync logs"
  ON public.activecampaign_sync_logs
  FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_activecampaign_sync_configs_updated_at
  BEFORE UPDATE ON public.activecampaign_sync_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX idx_ac_sync_configs_event_type ON public.activecampaign_sync_configs(event_type) WHERE is_active = true;
CREATE INDEX idx_ac_sync_logs_user_id ON public.activecampaign_sync_logs(user_id);
CREATE INDEX idx_ac_sync_logs_status ON public.activecampaign_sync_logs(status) WHERE status = 'pending';