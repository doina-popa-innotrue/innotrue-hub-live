-- 1. Create client_instructors table (mirrors client_coaches)
CREATE TABLE public.client_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, instructor_id)
);

-- Enable RLS
ALTER TABLE public.client_instructors ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_instructors
CREATE POLICY "Admins can manage client instructors"
ON public.client_instructors
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view their assignments"
ON public.client_instructors
FOR SELECT
USING (instructor_id = auth.uid());

CREATE POLICY "Clients can view their instructors"
ON public.client_instructors
FOR SELECT
USING (client_id = auth.uid());

-- 2. Create coach_instructor_requests table for client requests
CREATE TABLE public.coach_instructor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('coach', 'instructor', 'both')),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_instructor_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for requests
CREATE POLICY "Users can view their own requests"
ON public.coach_instructor_requests
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own requests"
ON public.coach_instructor_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all requests"
ON public.coach_instructor_requests
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Update staff_has_client_relationship to include client_instructors
CREATE OR REPLACE FUNCTION public.staff_has_client_relationship(_staff_id uuid, _client_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- 1. Direct coach assignment to client
    EXISTS (
      SELECT 1 FROM client_coaches
      WHERE coach_id = _staff_id AND client_id = _client_user_id
    )
    OR
    -- 1b. Direct instructor assignment to client
    EXISTS (
      SELECT 1 FROM client_instructors
      WHERE instructor_id = _staff_id AND client_id = _client_user_id
    )
    OR
    -- 2. Program instructor for any of client's enrolled programs
    EXISTS (
      SELECT 1 FROM program_instructors pi
      JOIN client_enrollments ce ON ce.program_id = pi.program_id
      WHERE pi.instructor_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 3. Program coach for any of client's enrolled programs
    EXISTS (
      SELECT 1 FROM program_coaches pc
      JOIN client_enrollments ce ON ce.program_id = pc.program_id
      WHERE pc.coach_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 4. Module instructor for any module in client's enrolled programs
    EXISTS (
      SELECT 1 FROM module_instructors mi
      JOIN program_modules pm ON pm.id = mi.module_id
      JOIN client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mi.instructor_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 5. Module coach for any module in client's enrolled programs
    EXISTS (
      SELECT 1 FROM module_coaches mc
      JOIN program_modules pm ON pm.id = mc.module_id
      JOIN client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mc.coach_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
$$;