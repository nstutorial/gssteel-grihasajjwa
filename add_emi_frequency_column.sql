-- Add emi_amount and emi_frequency columns to loans table
-- Run this in Supabase SQL Editor

-- Add emi_amount column if it doesn't exist
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS emi_amount DECIMAL(12,2);

-- Add emi_frequency column
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS emi_frequency TEXT CHECK (emi_frequency IN ('weekly', 'monthly')) DEFAULT 'weekly';

-- Update existing records to have 'weekly' as default emi_frequency
UPDATE public.loans 
SET emi_frequency = 'weekly' 
WHERE emi_frequency IS NULL;
