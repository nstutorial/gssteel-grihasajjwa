-- Add loan_number column to loans table
ALTER TABLE public.loans 
ADD COLUMN loan_number TEXT;

-- Create a function to generate 6-digit loan number
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT AS $$
DECLARE
  loan_num TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 6-digit number
    loan_num := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if this number already exists
    SELECT EXISTS(SELECT 1 FROM loans WHERE loan_number = loan_num) INTO exists_check;
    
    -- If it doesn't exist, exit the loop
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN loan_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate loan number on insert
CREATE OR REPLACE FUNCTION set_loan_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.loan_number IS NULL THEN
    NEW.loan_number := generate_loan_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_loan_number
BEFORE INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION set_loan_number();

-- Update existing loans with loan numbers
UPDATE public.loans 
SET loan_number = generate_loan_number() 
WHERE loan_number IS NULL;