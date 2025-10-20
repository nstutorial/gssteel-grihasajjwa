-- Quick fix script to add mahajans to existing user_settings
-- This can be run directly in Supabase SQL editor

-- Add mahajans field to all existing user_settings
UPDATE public.user_settings 
SET visible_tabs = visible_tabs || '{"mahajans": true}'::jsonb
WHERE NOT (visible_tabs ? 'mahajans');

-- Also update control_settings to include new Mahajan-related settings
UPDATE public.user_settings 
SET control_settings = control_settings || '{"allowBillManagement": true, "allowMahajanDeletion": true}'::jsonb
WHERE control_settings IS NOT NULL;

-- Show the updated settings
SELECT user_id, visible_tabs, control_settings 
FROM public.user_settings;
