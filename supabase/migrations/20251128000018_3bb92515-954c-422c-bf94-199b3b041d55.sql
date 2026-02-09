-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'coach', 'client');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');
CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'paused');
CREATE TYPE public.progress_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE public.program_category AS ENUM ('cta', 'leadership', 'executive', 'ai', 'deep-dive');
CREATE TYPE public.module_type AS ENUM ('session', 'assignment', 'reflection', 'resource');

-- User roles table (CRITICAL for security - roles must be in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table (extends auth.users with additional info)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Client profiles table
CREATE TABLE public.client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status user_status DEFAULT 'active' NOT NULL,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Programs table
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category program_category NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Program modules table
CREATE TABLE public.program_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  module_type module_type NOT NULL,
  order_index INTEGER NOT NULL,
  estimated_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, order_index)
);

ALTER TABLE public.program_modules ENABLE ROW LEVEL SECURITY;

-- Client enrollments table
CREATE TABLE public.client_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  status enrollment_status DEFAULT 'active' NOT NULL,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_user_id, program_id)
);

ALTER TABLE public.client_enrollments ENABLE ROW LEVEL SECURITY;

-- Module progress table
CREATE TABLE public.module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.program_modules(id) ON DELETE CASCADE NOT NULL,
  status progress_status DEFAULT 'not_started' NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(enrollment_id, module_id)
);

ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_program_modules_updated_at BEFORE UPDATE ON public.program_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_enrollments_updated_at BEFORE UPDATE ON public.client_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_module_progress_updated_at BEFORE UPDATE ON public.module_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for client_profiles
CREATE POLICY "Clients can view their own profile"
  ON public.client_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all client profiles"
  ON public.client_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all client profiles"
  ON public.client_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for programs
CREATE POLICY "Authenticated users can view active programs"
  ON public.programs FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage programs"
  ON public.programs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for program_modules
CREATE POLICY "Users can view modules of programs they're enrolled in or admins"
  ON public.program_modules FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE client_user_id = auth.uid() AND program_id = program_modules.program_id
    )
  );

CREATE POLICY "Admins can manage modules"
  ON public.program_modules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for client_enrollments
CREATE POLICY "Clients can view their own enrollments"
  ON public.client_enrollments FOR SELECT
  USING (auth.uid() = client_user_id);

CREATE POLICY "Admins can view all enrollments"
  ON public.client_enrollments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all enrollments"
  ON public.client_enrollments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for module_progress
CREATE POLICY "Clients can view their own progress"
  ON public.module_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE id = module_progress.enrollment_id AND client_user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update their own progress"
  ON public.module_progress FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE id = module_progress.enrollment_id AND client_user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert their own progress"
  ON public.module_progress FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE id = module_progress.enrollment_id AND client_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all progress"
  ON public.module_progress FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all progress"
  ON public.module_progress FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));