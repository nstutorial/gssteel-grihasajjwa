-- Create bill_customers table
CREATE TABLE public.bill_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  gst_number TEXT,
  outstanding_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bill_customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own bill customers"
ON public.bill_customers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bill customers"
ON public.bill_customers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill customers"
ON public.bill_customers
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill customers"
ON public.bill_customers
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_bill_customers_updated_at
BEFORE UPDATE ON public.bill_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update user_settings to include bill_customers visibility
UPDATE public.user_settings
SET visible_tabs = jsonb_set(
  COALESCE(visible_tabs, '{}'::jsonb),
  '{bill_customers}',
  'true'::jsonb
)
WHERE NOT (visible_tabs ? 'bill_customers');
