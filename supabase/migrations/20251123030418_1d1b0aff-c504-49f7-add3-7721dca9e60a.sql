-- Create cheque status history table
CREATE TABLE IF NOT EXISTS public.cheque_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cheque_id UUID NOT NULL REFERENCES public.cheques(id) ON DELETE CASCADE,
  old_status cheque_status,
  new_status cheque_status NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cheque_status_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view history for their cheques"
ON public.cheque_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cheques
    WHERE cheques.id = cheque_status_history.cheque_id
    AND cheques.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create history for their cheques"
ON public.cheque_status_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cheques
    WHERE cheques.id = cheque_status_history.cheque_id
    AND cheques.user_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_cheque_status_history_cheque_id ON public.cheque_status_history(cheque_id);
CREATE INDEX idx_cheque_status_history_changed_at ON public.cheque_status_history(changed_at DESC);