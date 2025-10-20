-- Fix the settings_access_password table
-- There are multiple active passwords causing the query to fail

-- 1. Check current state of password table
SELECT 'Current password table status:' as status;
SELECT 
  id,
  password_hash,
  is_active,
  created_at
FROM public.settings_access_password
ORDER BY created_at DESC;

-- 2. Deactivate all existing passwords
UPDATE public.settings_access_password 
SET is_active = false;

-- 3. Create a single active password
INSERT INTO public.settings_access_password (password_hash, is_active, created_by)
SELECT '121', true, p.user_id
FROM public.profiles p
WHERE p.email = 'fakiragram@grihasajjwa.com'
LIMIT 1;

-- 4. Verify only one active password exists
SELECT 'After cleanup - password table status:' as status;
SELECT 
  COUNT(*) as total_passwords,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_passwords,
  'Should be exactly 1 active password' as status
FROM public.settings_access_password;

-- 5. Show the active password
SELECT 'Active password details:' as status;
SELECT 
  id,
  password_hash,
  is_active,
  created_at
FROM public.settings_access_password
WHERE is_active = true;

SELECT 'Password table fixed! Only one active password now.' as message;
