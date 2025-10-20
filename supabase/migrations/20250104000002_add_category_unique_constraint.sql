-- Add updated_at column to expense_categories table
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Add unique constraint to prevent duplicate category names per user and type
-- This ensures that a user cannot have two categories with the same name and type
CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_user_type_name_unique 
ON public.expense_categories (user_id, type, LOWER(name));

-- Add a comment explaining the constraint
COMMENT ON INDEX expense_categories_user_type_name_unique IS 'Ensures unique category names per user and type (case-insensitive)';
