-- Add locked column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;

-- Add locked column to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;
