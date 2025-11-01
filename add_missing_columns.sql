-- Add missing columns to fix database schema issues
-- Run this in your Supabase SQL Editor

-- Add description column to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS description TEXT;

-- Add payment_day column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_day TEXT;

-- Success message
SELECT 'Missing columns added successfully!' as status;
