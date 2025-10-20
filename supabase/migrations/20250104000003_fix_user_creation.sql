-- Fix the handle_new_user function to create user_settings
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

-- Create user_settings for existing users who don't have them
INSERT INTO public.user_settings (user_id, visible_tabs, control_settings)
SELECT 
  p.user_id,
  '{"loans": true, "customers": true, "daywise": true, "payments": true}'::jsonb,
  '{"allowEdit": true, "allowDelete": true, "allowAddNew": true, "allowExport": true, "showFinancialTotals": true, "allowBulkOperations": true, "allowPaymentManager": true}'::jsonb
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_settings us 
  WHERE us.user_id = p.user_id
);
