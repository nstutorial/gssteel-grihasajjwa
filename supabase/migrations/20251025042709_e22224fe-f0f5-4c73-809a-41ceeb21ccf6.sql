-- Create sales table for bill customers
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bill_customer_id UUID NOT NULL REFERENCES public.bill_customers(id) ON DELETE CASCADE,
  sale_number TEXT,
  sale_amount NUMERIC NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  interest_rate NUMERIC DEFAULT 0,
  interest_type TEXT DEFAULT 'none',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sales"
  ON public.sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales"
  ON public.sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales"
  ON public.sales FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate sale number
CREATE OR REPLACE FUNCTION public.generate_sale_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_num TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    sale_num := 'S' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM sales WHERE sale_number = sale_num) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN sale_num;
END;
$$;

-- Trigger to set sale number
CREATE OR REPLACE FUNCTION public.set_sale_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_sale_number_trigger
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sale_number();

-- Create sale_transactions table
CREATE TABLE public.sale_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL,
  payment_mode payment_method NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view transactions for their sales"
  ON public.sale_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_transactions.sale_id
    AND sales.user_id = auth.uid()
  ));

CREATE POLICY "Users can create transactions for their sales"
  ON public.sale_transactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_transactions.sale_id
    AND sales.user_id = auth.uid()
  ));

CREATE POLICY "Users can update transactions for their sales"
  ON public.sale_transactions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_transactions.sale_id
    AND sales.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete transactions for their sales"
  ON public.sale_transactions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_transactions.sale_id
    AND sales.user_id = auth.uid()
  ));