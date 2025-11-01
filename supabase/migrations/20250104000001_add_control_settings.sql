-- Add control_settings column to user_settings table
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS control_settings JSONB DEFAULT '{
  "allowEdit": true,
  "allowDelete": true,
  "allowAddNew": true,
  "allowExport": true,
  "showFinancialTotals": true,
  "allowBulkOperations": true
}'::jsonb;

-- Update existing records to have default control settings
UPDATE public.user_settings 
SET control_settings = '{
  "allowEdit": true,
  "allowDelete": true,
  "allowAddNew": true,
  "allowExport": true,
  "showFinancialTotals": true,
  "allowBulkOperations": true
}'::jsonb
WHERE control_settings IS NULL;
