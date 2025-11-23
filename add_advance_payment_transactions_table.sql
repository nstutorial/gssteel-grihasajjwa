-- Create table for advance payment transactions
CREATE TABLE IF NOT EXISTS public.advance_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mahajan_id UUID NOT NULL REFERENCES public.mahajans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'bank')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.advance_payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own advance payment transactions"
  ON public.advance_payment_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own advance payment transactions"
  ON public.advance_payment_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own advance payment transactions"
  ON public.advance_payment_transactions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own advance payment transactions"
  ON public.advance_payment_transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_advance_payment_transactions_updated_at
  BEFORE UPDATE ON public.advance_payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_advance_payment_transactions_mahajan_id 
  ON public.advance_payment_transactions(mahajan_id);

CREATE INDEX idx_advance_payment_transactions_user_id 
  ON public.advance_payment_transactions(user_id);
