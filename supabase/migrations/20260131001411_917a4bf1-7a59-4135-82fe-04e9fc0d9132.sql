-- Add calcom_mapping_id to groups table for group-level scheduling configuration
ALTER TABLE public.groups 
ADD COLUMN calcom_mapping_id UUID REFERENCES public.calcom_event_type_mappings(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_groups_calcom_mapping_id ON public.groups(calcom_mapping_id);

-- Add comment for documentation
COMMENT ON COLUMN public.groups.calcom_mapping_id IS 'Reference to the Cal.com event type mapping used for booking group sessions';