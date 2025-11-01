-- Add RLS policies for updating and deleting firm transactions
CREATE POLICY "Users can update their own firm transactions"
ON firm_transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM firm_accounts
    WHERE firm_accounts.id = firm_transactions.firm_account_id
    AND firm_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own firm transactions"
ON firm_transactions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM firm_accounts
    WHERE firm_accounts.id = firm_transactions.firm_account_id
    AND firm_accounts.user_id = auth.uid()
  )
);