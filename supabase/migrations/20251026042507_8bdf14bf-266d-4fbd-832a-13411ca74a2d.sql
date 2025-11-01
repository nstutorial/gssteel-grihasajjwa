-- Create partners table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  total_invested NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for partners
CREATE POLICY "Users can view their own partners"
  ON public.partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own partners"
  ON public.partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own partners"
  ON public.partners FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own partners"
  ON public.partners FOR DELETE
  USING (auth.uid() = user_id);

-- Create partner_transactions table
CREATE TABLE public.partner_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL,
  mahajan_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for partner_transactions
CREATE POLICY "Users can view transactions for their partners"
  ON public.partner_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM partners
    WHERE partners.id = partner_transactions.partner_id
    AND partners.user_id = auth.uid()
  ));

CREATE POLICY "Users can create transactions for their partners"
  ON public.partner_transactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM partners
    WHERE partners.id = partner_transactions.partner_id
    AND partners.user_id = auth.uid()
  ));

CREATE POLICY "Users can update transactions for their partners"
  ON public.partner_transactions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM partners
    WHERE partners.id = partner_transactions.partner_id
    AND partners.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete transactions for their partners"
  ON public.partner_transactions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM partners
    WHERE partners.id = partner_transactions.partner_id
    AND partners.user_id = auth.uid()
  ));

-- Create trigger for updated_at on partners
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
