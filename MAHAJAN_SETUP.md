# Mahajan Tab Setup Instructions

## Issue
The Mahajan tab is not showing in the Dashboard because existing user_settings in the database don't have the `mahajans` field.

## Solution

### Option 1: Run the Migration (Recommended)
If you have Supabase CLI set up and linked:

```bash
npx supabase db push
```

### Option 2: Manual Database Update
If you can't run migrations, execute this SQL in your Supabase SQL editor:

```sql
-- Add mahajans field to all existing user_settings
UPDATE public.user_settings 
SET visible_tabs = visible_tabs || '{"mahajans": true}'::jsonb
WHERE NOT (visible_tabs ? 'mahajans');

-- Also update control_settings to include new Mahajan-related settings
UPDATE public.user_settings 
SET control_settings = control_settings || '{"allowBillManagement": true, "allowMahajanDeletion": true}'::jsonb
WHERE control_settings IS NOT NULL;

-- Verify the update
SELECT user_id, visible_tabs, control_settings 
FROM public.user_settings;
```

### Option 3: Code-Level Fix (Already Applied)
The code has been updated to handle missing `mahajans` field gracefully by defaulting to `true` if the field is missing.

## Verification
After applying the fix:

1. Refresh your application
2. Go to Settings page
3. Verify "Mahajans" appears in Tab Visibility Settings
4. Go to Dashboard
5. Verify "Mahajans" tab appears in the main navigation

## Features Available
Once the Mahajan tab is visible, you'll have access to:

- **Mahajan List**: View and manage all mahajans
- **Summary Report**: Comprehensive reporting with filtering
- **Payment Manager**: Day-wise payment management
- **Add Mahajan**: Create new mahajan records
- **Add Bill**: Create bills for mahajans
- **Bill Management**: Track bill amounts and payments paid
- **PDF Statements**: Export mahajan statements
- **CSV Export**: Export summary reports

## Database Tables Created
- `mahajans`: Store mahajan information
- `bills`: Store bill information (similar to loans)
- `bill_transactions`: Store payment transactions (similar to loan_transactions)
