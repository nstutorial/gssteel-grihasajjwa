# Settings Access Password Management System

This document explains the password management system implemented for controlling access to the Settings page.

## Overview

The system provides two-tier access control:
- **Admin users**: Can access Settings page without password restrictions
- **Non-admin users**: Must enter a password set by admins to access the Settings page

## Features

### 1. Admin Access
- Admins can access `/settings` without any password
- Admins can access `/password-management` to set/change the access password
- Admin role is determined by the `user_role` column in the `profiles` table

### 2. Password Management
- Admins can set or update the settings access password
- Password is stored in the `settings_access_password` table
- Only one active password can exist at a time
- Password verification persists for the browser session

### 3. Security
- Row Level Security (RLS) policies protect the password table
- Only admins can modify the settings access password
- Password verification is session-based (clears on browser restart)

## Database Schema

### Tables Created

#### `settings_access_password`
```sql
CREATE TABLE public.settings_access_password (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);
```

#### `profiles` table updated
- Added `user_role` column with constraint: `CHECK (user_role IN ('admin', 'employee'))`

### RLS Policies
- Only admins can manage settings access passwords
- Users can only access their own profile data

## Routes

### `/settings`
- **Access**: All authenticated users
- **Behavior**: 
  - Admin users: Direct access
  - Non-admin users: Password prompt required

### `/password-management`
- **Access**: Admin users only
- **Behavior**: Shows access denied for non-admin users

## Setup Instructions

### 1. Run Database Migrations
Execute the following migration files in order:
1. `supabase/migrations/20250105000000_add_settings_access_password.sql`
2. `supabase/migrations/20250105000001_add_user_role_column.sql`

### 2. Set Up Admin User
Use the provided `setup_admin_user.sql` script:

```sql
-- Replace 'your-email@example.com' with your admin user's email
UPDATE public.profiles SET user_role = 'admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- Set default password (optional)
INSERT INTO public.settings_access_password (password_hash, created_by, is_active)
VALUES ('121', (SELECT id FROM auth.users WHERE email = 'your-email@example.com'), true)
ON CONFLICT DO NOTHING;
```

### 3. Test the System

#### For Admin Users:
1. Navigate to `http://localhost:8080/settings` - should access directly
2. Navigate to `http://localhost:8080/password-management` - should access directly
3. Change the settings access password
4. Test that non-admin users need the new password

#### For Non-Admin Users:
1. Navigate to `http://localhost:8080/settings` - should prompt for password
2. Enter the password set by admin
3. Navigate to `http://localhost:8080/password-management` - should show access denied

## Security Considerations

### Current Implementation
- Passwords are stored in plain text (for simplicity)
- Session-based verification (clears on browser restart)
- No password complexity requirements

### Production Recommendations
1. **Hash passwords**: Use bcrypt or similar to hash passwords before storage
2. **Session timeout**: Implement automatic session expiration
3. **Password complexity**: Enforce minimum password requirements
4. **Audit logging**: Log password changes and access attempts
5. **Rate limiting**: Prevent brute force attacks on password verification

## Troubleshooting

### Common Issues

1. **"Access Denied" for admin users**
   - Check if `user_role` is set to 'admin' in profiles table
   - Verify RPC function `get_user_role` exists and works

2. **Password verification fails**
   - Check if password exists in `settings_access_password` table
   - Verify `is_active` is true for the password record

3. **TypeScript errors**
   - Ensure database migrations have been run
   - Regenerate TypeScript types if needed

### Debug Queries

```sql
-- Check user roles
SELECT p.user_id, au.email, p.user_role 
FROM public.profiles p 
JOIN auth.users au ON p.user_id = au.id;

-- Check settings password status
SELECT * FROM public.settings_access_password WHERE is_active = true;

-- Test RPC function
SELECT get_user_role('your-user-id-here');
```

## API Endpoints

### Password Verification
- **Method**: Client-side verification
- **Process**: Queries `settings_access_password` table directly

### Password Management
- **Method**: Direct database operations
- **Access**: Admin users only (enforced by RLS policies)

## Future Enhancements

1. **Password History**: Track previous passwords
2. **Password Expiration**: Automatic password expiry
3. **Multi-factor Authentication**: Additional security layers
4. **Admin Dashboard**: Centralized user and password management
5. **Audit Trail**: Comprehensive logging of all access attempts
