-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Create payment methods enum
CREATE TYPE public.payment_method AS ENUM ('cash', 'bank');

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  payment_method payment_method NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create customers table for lending
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create loans table
CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  principal_amount DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  interest_type TEXT CHECK (interest_type IN ('daily', 'monthly', 'none')) DEFAULT 'none',
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Create loan transactions table (payments received)
CREATE TABLE public.loan_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('principal', 'interest', 'mixed')) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for expense categories
CREATE POLICY "Users can view their own categories" 
ON public.expense_categories FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories" 
ON public.expense_categories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON public.expense_categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON public.expense_categories FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for expenses
CREATE POLICY "Users can view their own expenses" 
ON public.expenses FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expenses" 
ON public.expenses FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses" 
ON public.expenses FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses" 
ON public.expenses FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for customers
CREATE POLICY "Users can view their own customers" 
ON public.customers FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own customers" 
ON public.customers FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own customers" 
ON public.customers FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own customers" 
ON public.customers FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for loans
CREATE POLICY "Users can view their own loans" 
ON public.loans FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loans" 
ON public.loans FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loans" 
ON public.loans FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own loans" 
ON public.loans FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for loan transactions
CREATE POLICY "Users can view transactions for their loans" 
ON public.loan_transactions FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.loans 
  WHERE loans.id = loan_transactions.loan_id 
  AND loans.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their loans" 
ON public.loan_transactions FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.loans 
  WHERE loans.id = loan_transactions.loan_id 
  AND loans.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions for their loans" 
ON public.loan_transactions FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.loans 
  WHERE loans.id = loan_transactions.loan_id 
  AND loans.user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions for their loans" 
ON public.loan_transactions FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.loans 
  WHERE loans.id = loan_transactions.loan_id 
  AND loans.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Create default expense categories
  INSERT INTO public.expense_categories (user_id, name) VALUES
    (NEW.id, 'Food & Dining'),
    (NEW.id, 'Transportation'),
    (NEW.id, 'Shopping'),
    (NEW.id, 'Bills & Utilities'),
    (NEW.id, 'Healthcare'),
    (NEW.id, 'Entertainment'),
    (NEW.id, 'Others');
  
  -- Create default user settings
  INSERT INTO public.user_settings (user_id, visible_tabs, control_settings) VALUES
    (NEW.id, 
     '{"loans": true, "customers": true, "daywise": true, "payments": true}'::jsonb,
     '{"allowEdit": true, "allowDelete": true, "allowAddNew": true, "allowExport": true, "showFinancialTotals": true, "allowBulkOperations": true, "allowPaymentManager": true}'::jsonb
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();