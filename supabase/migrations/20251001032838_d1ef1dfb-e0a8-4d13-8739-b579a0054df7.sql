-- Create sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_amount NUMERIC NOT NULL,
  sale_description TEXT NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own sales" 
ON public.sales FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sales" 
ON public.sales FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales" 
ON public.sales FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales" 
ON public.sales FOR DELETE 
USING (auth.uid() = user_id);

-- Create sale_transactions table
CREATE TABLE IF NOT EXISTS public.sale_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sale_transactions
CREATE POLICY "Users can view transactions for their sales" 
ON public.sale_transactions FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_transactions.sale_id 
  AND sales.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their sales" 
ON public.sale_transactions FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_transactions.sale_id 
  AND sales.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions for their sales" 
ON public.sale_transactions FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_transactions.sale_id 
  AND sales.user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions for their sales" 
ON public.sale_transactions FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_transactions.sale_id 
  AND sales.user_id = auth.uid()
));

-- Create user_settings table for controlling tab visibility
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  visible_tabs JSONB NOT NULL DEFAULT '{"expenses": true, "loans": true, "customers": true, "sales": true, "daywise": true, "payments": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own settings" 
ON public.user_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
ON public.user_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings FOR UPDATE 
USING (auth.uid() = user_id);