-- Add mahajans field to existing user_settings
-- Update existing user_settings to include mahajans field
UPDATE public.user_settings 
SET visible_tabs = visible_tabs || '{"mahajans": true}'::jsonb
WHERE NOT (visible_tabs ? 'mahajans');

-- Update the default visible_tabs in the table definition
ALTER TABLE public.user_settings 
ALTER COLUMN visible_tabs SET DEFAULT '{"loans": true, "customers": true, "mahajans": true, "daywise": true, "payments": true}'::jsonb;

-- Update the handle_new_user function to include mahajans in default settings
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
  
  -- Create default user settings with mahajans included
  INSERT INTO public.user_settings (user_id, visible_tabs, control_settings) VALUES
    (NEW.id, 
     '{"loans": true, "customers": true, "mahajans": true, "daywise": true, "payments": true}'::jsonb,
     '{"allowEdit": true, "allowDelete": true, "allowAddNew": true, "allowExport": true, "showFinancialTotals": true, "allowBulkOperations": true, "allowAddPayment": true, "allowPaymentManager": true, "allowRecordPayment": true, "allowEmailChange": true, "allowBillManagement": true, "allowMahajanDeletion": true}'::jsonb
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
