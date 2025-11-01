-- Add foreign key constraint between partner_transactions and partners
ALTER TABLE public.partner_transactions
ADD CONSTRAINT partner_transactions_partner_id_fkey
FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;
