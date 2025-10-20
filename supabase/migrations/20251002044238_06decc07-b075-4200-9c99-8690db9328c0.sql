-- Add type column to expenses table to distinguish between expenses and earnings
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';

-- Add check constraint to ensure type is either 'expense' or 'earning'
ALTER TABLE public.expenses ADD CONSTRAINT expenses_type_check CHECK (type IN ('expense', 'earning'));