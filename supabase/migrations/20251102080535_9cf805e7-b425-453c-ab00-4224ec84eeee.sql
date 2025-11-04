-- Add processing_fee and total_outstanding columns to loans table
ALTER TABLE public.loans 
ADD COLUMN processing_fee numeric DEFAULT 0,
ADD COLUMN total_outstanding numeric DEFAULT 0;