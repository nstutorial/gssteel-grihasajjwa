-- Add type column to expense_categories to distinguish between expense and income categories
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';

-- Add check constraint to ensure type is either 'expense' or 'income'
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_type_check CHECK (type IN ('expense', 'income'));

-- Update the handle_new_user function to create default income categories based on Indian Income Tax
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
  INSERT INTO public.expense_categories (user_id, name, type) VALUES
    (NEW.id, 'Food & Dining', 'expense'),
    (NEW.id, 'Transportation', 'expense'),
    (NEW.id, 'Shopping', 'expense'),
    (NEW.id, 'Bills & Utilities', 'expense'),
    (NEW.id, 'Healthcare', 'expense'),
    (NEW.id, 'Entertainment', 'expense'),
    (NEW.id, 'Others', 'expense');
  
  -- Create default income categories based on Indian Income Tax Act
  INSERT INTO public.expense_categories (user_id, name, type) VALUES
    (NEW.id, 'Salary/Pension', 'income'),
    (NEW.id, 'House Property', 'income'),
    (NEW.id, 'Business/Profession', 'income'),
    (NEW.id, 'Capital Gains', 'income'),
    (NEW.id, 'Other Sources', 'income');
  
  RETURN NEW;
END;
$function$;