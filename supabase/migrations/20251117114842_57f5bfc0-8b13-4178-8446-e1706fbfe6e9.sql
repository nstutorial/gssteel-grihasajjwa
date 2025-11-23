-- Create cheque status enum
CREATE TYPE cheque_status AS ENUM ('pending', 'processing', 'cleared', 'bounced');

-- Create cheque type enum
CREATE TYPE cheque_type AS ENUM ('received', 'issued');

-- Create cheques table
CREATE TABLE public.cheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type cheque_type NOT NULL,
  cheque_number TEXT NOT NULL,
  cheque_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  bank_name TEXT NOT NULL,
  status cheque_status NOT NULL DEFAULT 'pending',
  bank_transaction_id TEXT,
  bounce_charges NUMERIC DEFAULT 0,
  mahajan_id UUID REFERENCES public.mahajans(id) ON DELETE SET NULL,
  firm_account_id UUID REFERENCES public.firm_accounts(id) ON DELETE SET NULL,
  party_name TEXT,
  notes TEXT,
  cleared_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own cheques"
  ON public.cheques
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cheques"
  ON public.cheques
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cheques"
  ON public.cheques
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cheques"
  ON public.cheques
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_cheques_updated_at
  BEFORE UPDATE ON public.cheques
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_cheques_user_id ON public.cheques(user_id);
CREATE INDEX idx_cheques_status ON public.cheques(status);
CREATE INDEX idx_cheques_type ON public.cheques(type);