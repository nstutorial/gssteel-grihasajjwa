-- Add confirmation tracking to loan transactions
ALTER TABLE loan_transactions 
ADD COLUMN is_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN confirmed_by UUID REFERENCES auth.users(id);

-- Create indexes for better performance
CREATE INDEX idx_loan_transactions_is_confirmed ON loan_transactions(is_confirmed);
CREATE INDEX idx_loan_transactions_confirmed_date ON loan_transactions(is_confirmed, confirmed_at);

-- Add comment for documentation
COMMENT ON COLUMN loan_transactions.is_confirmed IS 'Indicates if the transaction has been confirmed by user and cannot be edited';
COMMENT ON COLUMN loan_transactions.confirmed_at IS 'Timestamp when the transaction was confirmed';
COMMENT ON COLUMN loan_transactions.confirmed_by IS 'User ID who confirmed the transaction';
