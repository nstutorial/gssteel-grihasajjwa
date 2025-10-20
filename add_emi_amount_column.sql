-- Add emi_amount column to loans table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS emi_amount DECIMAL(12,2);

-- Success message
SELECT 'EMI amount column added to loans table successfully!' as status;
