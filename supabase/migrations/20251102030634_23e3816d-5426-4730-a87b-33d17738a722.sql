-- Add transaction_sub_type column to firm_transactions
ALTER TABLE firm_transactions
ADD COLUMN transaction_sub_type TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN firm_transactions.transaction_sub_type IS 'Stores the specific transaction type like gst_tax_payment, income_tax_payment, etc. while transaction_type stores the category (expense/income)';