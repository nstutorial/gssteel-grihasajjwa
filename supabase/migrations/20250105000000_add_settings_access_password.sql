-- Create settings access password table
CREATE TABLE IF NOT EXISTS public.settings_access_password (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.settings_access_password ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage settings access password" 
ON public.settings_access_password 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_role = 'admin'
  )
);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT user_role INTO user_role
  FROM public.profiles
  WHERE user_id = user_id_param;
  
  RETURN COALESCE(user_role, 'employee');
END;
$$;

-- Insert default password (hash of '121')
INSERT INTO public.settings_access_password (password_hash, created_by, created_at, updated_at)
VALUES ('$2a$10$N9qo8uLOickgx2ZMRZoMye', auth.uid(), now(), now())
ON CONFLICT DO NOTHING;
