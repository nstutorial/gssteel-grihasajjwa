-- Add mahajan_id column to firm_transactions table
ALTER TABLE public.firm_transactions ADD COLUMN mahajan_id UUID REFERENCES public.mahajans(id) ON DELETE SET NULL;

-- Create custom_transaction_types table
CREATE TABLE public.custom_transaction_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS on custom_transaction_types
ALTER TABLE public.custom_transaction_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for custom_transaction_types
CREATE POLICY "Users can view their own custom transaction types"
ON public.custom_transaction_types FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom transaction types"
ON public.custom_transaction_types FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom transaction types"
ON public.custom_transaction_types FOR DELETE
USING (auth.uid() = user_id);

-- Insert default new transaction types for all existing users
INSERT INTO public.custom_transaction_types (user_id, name)
SELECT p.user_id, type_name
FROM public.profiles p
CROSS JOIN (
  VALUES 
    ('GST Tax Payment'),
    ('Income Tax Payment'),
    ('Paid To CA'),
    ('Paid To Supplier')
) AS types(type_name)
ON CONFLICT (user_id, name) DO NOTHING;