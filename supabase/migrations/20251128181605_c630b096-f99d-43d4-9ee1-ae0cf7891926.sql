-- Security Fix: Add missing RLS policies for proper data access control

-- Fix 1: Add INSERT policy on profiles table (CRITICAL)
-- Allows users to create their own profile record during signup
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Fix 2: Add INSERT policy on client_profiles table
-- Allows clients to create their own client profile if needed
CREATE POLICY "Clients can insert their own client profile"
ON public.client_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix 3: Add UPDATE policy on client_profiles table
-- Allows clients to update their own client profile data
CREATE POLICY "Clients can update their own client profile"
ON public.client_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Fix 4: Add DELETE policy on notification_preferences table
-- Allows users to delete/reset their notification preferences
CREATE POLICY "Users can delete their own notification preferences"
ON public.notification_preferences
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);