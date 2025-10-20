-- Complete Database Setup for Griha Sajjwa App
-- Run this script in your new Supabase project's SQL Editor

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
  type TEXT NOT NULL DEFAULT 'expense',
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
  type TEXT NOT NULL DEFAULT 'expense',
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
  daily_amount DECIMAL(12,2),
  outstanding_amount DECIMAL(12,2) DEFAULT 0,
  payment_day TEXT,
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
  loan_number TEXT,
  description TEXT,
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
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'bank')) DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_transactions ENABLE ROW LEVEL SECURITY;

-- Create user_settings table for controlling tab visibility
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  visible_tabs JSONB NOT NULL DEFAULT '{"loans": true, "customers": true, "daywise": true, "payments": true}'::jsonb,
  control_settings JSONB DEFAULT '{
    "allowEdit": true,
    "allowDelete": true,
    "allowAddNew": true,
    "allowExport": true,
    "showFinancialTotals": true,
    "allowBulkOperations": true
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

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

-- Create RLS policies for user_settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
ON public.user_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings FOR UPDATE 
USING (auth.uid() = user_id);

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

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to generate 6-digit loan number
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

-- Create trigger to auto-generate loan number on insert
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

CREATE TRIGGER trigger_set_loan_number
BEFORE INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION set_loan_number();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Create default expense categories
  INSERT INTO public.expense_categories (user_id, name, type, color) VALUES
    (NEW.id, 'Food & Dining', 'expense', '#EF4444'),
    (NEW.id, 'Transportation', 'expense', '#F97316'),
    (NEW.id, 'Shopping', 'expense', '#EC4899'),
    (NEW.id, 'Bills & Utilities', 'expense', '#6366F1'),
    (NEW.id, 'Healthcare', 'expense', '#10B981'),
    (NEW.id, 'Entertainment', 'expense', '#8B5CF6'),
    (NEW.id, 'Others', 'expense', '#6B7280');
  
  -- Create default income categories based on Indian Income Tax Act
  INSERT INTO public.expense_categories (user_id, name, type, color) VALUES
    (NEW.id, 'Salary/Pension', 'income', '#10B981'),
    (NEW.id, 'House Property', 'income', '#14B8A6'),
    (NEW.id, 'Business/Profession', 'income', '#3B82F6'),
    (NEW.id, 'Capital Gains', 'income', '#F97316'),
    (NEW.id, 'Other Sources', 'income', '#8B5CF6');
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add constraints
ALTER TABLE public.expenses ADD CONSTRAINT expenses_type_check CHECK (type IN ('expense', 'earning'));
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_type_check CHECK (type IN ('expense', 'income'));

-- Add unique constraint to prevent duplicate category names per user and type
CREATE UNIQUE INDEX expense_categories_user_type_name_unique 
ON public.expense_categories (user_id, type, LOWER(name));

-- Add a comment explaining the constraint
COMMENT ON INDEX expense_categories_user_type_name_unique IS 'Ensures unique category names per user and type (case-insensitive)';

-- Success message
SELECT 'Database setup completed successfully! All tables, policies, and functions have been created.' as status;
