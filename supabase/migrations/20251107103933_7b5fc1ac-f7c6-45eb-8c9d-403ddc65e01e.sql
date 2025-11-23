-- Add enquiry_date column to admission_enquiry table
ALTER TABLE public.admission_enquiry 
ADD COLUMN IF NOT EXISTS enquiry_date date NOT NULL DEFAULT CURRENT_DATE;

-- Update existing records to use created_at as enquiry_date
UPDATE public.admission_enquiry 
SET enquiry_date = created_at::date 
WHERE enquiry_date IS NULL;