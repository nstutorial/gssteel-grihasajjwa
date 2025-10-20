-- Add payment_mode column to loan_transactions table
ALTER TABLE public.loan_transactions 
ADD COLUMN IF NOT EXISTS payment_mode TEXT CHECK (payment_mode IN ('cash', 'bank')) DEFAULT 'cash';

-- Update existing records to have 'cash' as default payment mode
UPDATE public.loan_transactions 
SET payment_mode = 'cash' 
WHERE payment_mode IS NULL;
