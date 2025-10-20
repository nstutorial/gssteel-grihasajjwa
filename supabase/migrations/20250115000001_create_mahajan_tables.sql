-- Create mahajans table (similar to customers)
CREATE TABLE public.mahajans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  payment_day TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mahajans ENABLE ROW LEVEL SECURITY;

-- Create bills table (similar to loans but for bills)
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mahajan_id UUID NOT NULL REFERENCES public.mahajans(id) ON DELETE CASCADE,
  bill_number TEXT,
  bill_amount DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  interest_type TEXT CHECK (interest_type IN ('daily', 'monthly', 'none')) DEFAULT 'none',
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Create bill_transactions table (similar to loan_transactions but for payments paid)
CREATE TABLE public.bill_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('principal', 'interest', 'mixed')) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode payment_method NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_transactions ENABLE ROW LEVEL SECURITY;

-- Create a function to generate 6-digit bill number
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  bill_num TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 6-digit number
    bill_num := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if this number already exists
    SELECT EXISTS(SELECT 1 FROM bills WHERE bill_number = bill_num) INTO exists_check;
    
    -- If it doesn't exist, exit the loop
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN bill_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate bill number on insert
CREATE OR REPLACE FUNCTION set_bill_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bill_number IS NULL THEN
    NEW.bill_number := generate_bill_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_bill_number
BEFORE INSERT ON public.bills
FOR EACH ROW
EXECUTE FUNCTION set_bill_number();

-- Create RLS policies for mahajans
CREATE POLICY "Users can view their own mahajans" 
ON public.mahajans FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mahajans" 
ON public.mahajans FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mahajans" 
ON public.mahajans FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mahajans" 
ON public.mahajans FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for bills
CREATE POLICY "Users can view their own bills" 
ON public.bills FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bills" 
ON public.bills FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bills" 
ON public.bills FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bills" 
ON public.bills FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for bill_transactions
CREATE POLICY "Users can view transactions for their bills" 
ON public.bill_transactions FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bills 
  WHERE bills.id = bill_transactions.bill_id 
  AND bills.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their bills" 
ON public.bill_transactions FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bills 
  WHERE bills.id = bill_transactions.bill_id 
  AND bills.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions for their bills" 
ON public.bill_transactions FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.bills 
  WHERE bills.id = bill_transactions.bill_id 
  AND bills.user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions for their bills" 
ON public.bill_transactions FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.bills 
  WHERE bills.id = bill_transactions.bill_id 
  AND bills.user_id = auth.uid()
));
