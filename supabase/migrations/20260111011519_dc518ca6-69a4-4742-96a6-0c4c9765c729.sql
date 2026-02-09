-- Create tracks table (similar to plans)
CREATE TABLE public.tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create track_features table (similar to plan_features)
CREATE TABLE public.track_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(track_id, feature_id)
);

-- Create user_tracks table (user's selected tracks)
CREATE TABLE public.user_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);

-- Create track_ui_visibility table (which UI sections are visible per track)
CREATE TABLE public.track_ui_visibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  ui_key TEXT NOT NULL, -- e.g., 'sidebar.coaching', 'page.decisions', 'feature.mocks'
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(track_id, ui_key)
);

-- Enable RLS
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_ui_visibility ENABLE ROW LEVEL SECURITY;

-- Tracks are readable by all authenticated users
CREATE POLICY "Tracks are viewable by authenticated users"
ON public.tracks FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Track features are readable by all authenticated users
CREATE POLICY "Track features are viewable by authenticated users"
ON public.track_features FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Track UI visibility is readable by all authenticated users
CREATE POLICY "Track UI visibility is viewable by authenticated users"
ON public.track_ui_visibility FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can view their own track selections
CREATE POLICY "Users can view their own tracks"
ON public.user_tracks FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own track selections
CREATE POLICY "Users can insert their own tracks"
ON public.user_tracks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracks"
ON public.user_tracks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracks"
ON public.user_tracks FOR DELETE
USING (auth.uid() = user_id);

-- Admin policies for tracks management
CREATE POLICY "Admins can manage tracks"
ON public.tracks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can manage track features"
ON public.track_features FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can manage track UI visibility"
ON public.track_ui_visibility FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admins can view all user tracks
CREATE POLICY "Admins can view all user tracks"
ON public.user_tracks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admins can manage user tracks
CREATE POLICY "Admins can manage user tracks"
ON public.user_tracks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create function to get effective track features (highest limit wins)
CREATE OR REPLACE FUNCTION public.get_effective_track_features(p_user_id UUID)
RETURNS TABLE (
  feature_id UUID,
  feature_key TEXT,
  feature_name TEXT,
  is_enabled BOOLEAN,
  limit_value INT,
  source_track_id UUID,
  source_track_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_active_tracks AS (
    SELECT ut.track_id
    FROM user_tracks ut
    WHERE ut.user_id = p_user_id AND ut.is_active = true
  ),
  all_track_features AS (
    SELECT 
      tf.feature_id,
      f.key as feature_key,
      f.name as feature_name,
      tf.is_enabled,
      tf.limit_value,
      tf.track_id,
      t.name as track_name,
      ROW_NUMBER() OVER (
        PARTITION BY tf.feature_id 
        ORDER BY COALESCE(tf.limit_value, 0) DESC, tf.is_enabled DESC
      ) as rn
    FROM track_features tf
    JOIN user_active_tracks uat ON tf.track_id = uat.track_id
    JOIN features f ON tf.feature_id = f.id
    JOIN tracks t ON tf.track_id = t.id
    WHERE tf.is_enabled = true
  )
  SELECT 
    atf.feature_id,
    atf.feature_key,
    atf.feature_name,
    atf.is_enabled,
    atf.limit_value,
    atf.track_id as source_track_id,
    atf.track_name as source_track_name
  FROM all_track_features atf
  WHERE atf.rn = 1;
END;
$$;

-- Create function to check UI visibility based on active tracks
CREATE OR REPLACE FUNCTION public.get_track_ui_visibility(p_user_id UUID)
RETURNS TABLE (
  ui_key TEXT,
  is_visible BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_active_tracks AS (
    SELECT ut.track_id
    FROM user_tracks ut
    WHERE ut.user_id = p_user_id AND ut.is_active = true
  )
  SELECT 
    tuv.ui_key,
    bool_or(tuv.is_visible) as is_visible -- visible if ANY active track shows it
  FROM track_ui_visibility tuv
  JOIN user_active_tracks uat ON tuv.track_id = uat.track_id
  GROUP BY tuv.ui_key;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_tracks_updated_at
BEFORE UPDATE ON public.tracks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_tracks_updated_at
BEFORE UPDATE ON public.user_tracks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial tracks
INSERT INTO public.tracks (name, key, description, display_order) VALUES
('CTA Track', 'cta', 'For Certified Transaction Advisor training and certification', 1),
('Leadership Track', 'leadership', 'For leadership development and coaching', 2);