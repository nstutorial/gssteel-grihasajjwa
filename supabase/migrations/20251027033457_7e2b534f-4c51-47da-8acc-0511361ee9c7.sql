-- Add foreign key constraint between partner_transactions and mahajans
ALTER TABLE public.partner_transactions
ADD CONSTRAINT partner_transactions_mahajan_id_fkey
FOREIGN KEY (mahajan_id) REFERENCES public.mahajans(id) ON DELETE CASCADE;
