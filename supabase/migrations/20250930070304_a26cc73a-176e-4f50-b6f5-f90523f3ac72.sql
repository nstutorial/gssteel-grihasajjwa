-- Fix search_path for loan number functions
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loan_num TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    loan_num := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM loans WHERE loan_number = loan_num) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN loan_num;
END;
$$;

CREATE OR REPLACE FUNCTION set_loan_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.loan_number IS NULL THEN
    NEW.loan_number := generate_loan_number();
  END IF;
  RETURN NEW;
END;
$$;