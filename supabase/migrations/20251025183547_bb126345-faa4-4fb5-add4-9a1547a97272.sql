-- Add advance_payment column to mahajans table
ALTER TABLE public.mahajans 
ADD COLUMN advance_payment numeric DEFAULT 0 NOT NULL;
