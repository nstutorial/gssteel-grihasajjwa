-- Add description column to expense_categories
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS description TEXT;

-- Add color column to expense_categories with default blue color
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Update existing categories with default colors
UPDATE public.expense_categories SET color = '#EF4444' WHERE name = 'Food & Dining' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#F97316' WHERE name = 'Transportation' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#EC4899' WHERE name = 'Shopping' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#6366F1' WHERE name = 'Bills & Utilities' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#10B981' WHERE name = 'Healthcare' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#8B5CF6' WHERE name = 'Entertainment' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#6B7280' WHERE name = 'Others' AND color = '#3B82F6';

-- Update income categories with default colors
UPDATE public.expense_categories SET color = '#10B981' WHERE name = 'Salary/Pension' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#14B8A6' WHERE name = 'House Property' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#3B82F6' WHERE name = 'Business/Profession' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#F97316' WHERE name = 'Capital Gains' AND color = '#3B82F6';
UPDATE public.expense_categories SET color = '#8B5CF6' WHERE name = 'Other Sources' AND color = '#3B82F6';

