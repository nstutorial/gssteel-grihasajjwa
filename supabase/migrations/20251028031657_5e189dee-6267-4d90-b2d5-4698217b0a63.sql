-- Create firm accounts table for bank and cash accounts
CREATE TABLE public.firm_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'cash')),
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  account_number TEXT,
  bank_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.firm_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for firm_accounts
CREATE POLICY "Users can view their own firm accounts" 
ON public.firm_accounts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own firm accounts" 
ON public.firm_accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own firm accounts" 
ON public.firm_accounts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own firm accounts" 
ON public.firm_accounts FOR DELETE 
USING (auth.uid() = user_id);

-- Create firm transactions table to track all firm account movements
CREATE TABLE public.firm_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_account_id UUID NOT NULL REFERENCES public.firm_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('partner_withdrawal', 'refund', 'partner_investment', 'expense', 'income', 'transfer')),
  amount NUMERIC(12,2) NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.firm_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for firm_transactions
CREATE POLICY "Users can view transactions for their firm accounts" 
ON public.firm_transactions FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.firm_accounts 
  WHERE firm_accounts.id = firm_transactions.firm_account_id 
  AND firm_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their firm accounts" 
ON public.firm_transactions FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.firm_accounts 
  WHERE firm_accounts.id = firm_transactions.firm_account_id 
  AND firm_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions for their firm accounts" 
ON public.firm_transactions FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.firm_accounts 
  WHERE firm_accounts.id = firm_transactions.firm_account_id 
  AND firm_accounts.user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions for their firm accounts" 
ON public.firm_transactions FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.firm_accounts 
  WHERE firm_accounts.id = firm_transactions.firm_account_id 
  AND firm_accounts.user_id = auth.uid()
));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_firm_accounts_updated_at
  BEFORE UPDATE ON public.firm_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
