-- Add display_order column to firm_accounts for custom ordering
ALTER TABLE public.firm_accounts 
ADD COLUMN display_order integer DEFAULT 0;