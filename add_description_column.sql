-- Add description column to loans table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS description TEXT;

-- Success message
SELECT 'Description column added to loans table successfully!' as status;
