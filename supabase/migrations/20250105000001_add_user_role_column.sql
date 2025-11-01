-- Add user_role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'employee';

-- Update existing profiles to have employee role
UPDATE public.profiles SET user_role = 'employee' WHERE user_role IS NULL;

-- Add constraint to ensure valid roles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_role_check CHECK (user_role IN ('admin', 'employee'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS profiles_user_role_idx ON public.profiles (user_role);
