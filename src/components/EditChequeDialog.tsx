import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Cheque {
  id: string;
  type: 'received' | 'issued';
  cheque_number: string;
  cheque_date: string;
  amount: number;
  bank_name: string;
  status: 'pending' | 'processing' | 'cleared' | 'bounced';
  bank_transaction_id: string | null;
  bounce_charges: number;
  mahajan_id: string | null;
  firm_account_id: string | null;
  party_name: string | null;
  notes: string | null;
  cleared_date: string | null;
}

interface EditChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: Cheque;
  onSuccess: () => void;
}

export function EditChequeDialog({ open, onOpenChange, cheque, onSuccess }: EditChequeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(cheque.status);
  const [bankTransactionId, setBankTransactionId] = useState(cheque.bank_transaction_id || '');
  const [bounceCharges, setBounceCharges] = useState(cheque.bounce_charges.toString());
  const [clearedDate, setClearedDate] = useState<Date | undefined>(
    cheque.cleared_date ? new Date(cheque.cleared_date) : undefined
  );
  const [notes, setNotes] = useState(cheque.notes || '');

  // Track original status to detect changes
  const originalStatus = cheque.status;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status === 'cleared' && !bankTransactionId) {
      toast.error('Bank transaction ID is required for cleared cheques');
      return;
    }

    if (status === 'cleared' && !clearedDate) {
      toast.error('Cleared date is required for cleared cheques');
      return;
    }

    try {
      setLoading(true);

      // Log status change if status has changed
      if (status !== originalStatus) {
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData.user) {
          const { error: historyError } = await supabase
            .from('cheque_status_history')
            .insert({
              cheque_id: cheque.id,
              old_status: originalStatus,
              new_status: status,
              changed_by: userData.user.id,
              notes: notes || null,
            });

          if (historyError) {
            console.error('Error logging status history:', historyError);
          }
        }
      }

      // Update cheque status
      const { error: chequeError } = await supabase
        .from('cheques')
        .update({
          status,
          bank_transaction_id: bankTransactionId || null,
          bounce_charges: parseFloat(bounceCharges) || 0,
          cleared_date: clearedDate ? format(clearedDate, 'yyyy-MM-dd') : null,
          notes,
        })
        .eq('id', cheque.id);

      if (chequeError) throw chequeError;

      // If cheque status CHANGED to cleared and firm account is linked, update firm account balance
      if (status === 'cleared' && originalStatus !== 'cleared' && cheque.firm_account_id) {
        const { data: accountData } = await supabase
          .from('firm_accounts')
          .select('current_balance')
          .eq('id', cheque.firm_account_id)
          .single();

        if (accountData) {
          const newBalance =
            cheque.type === 'received'
              ? accountData.current_balance + cheque.amount
              : accountData.current_balance - cheque.amount;

          const { error: balanceError } = await supabase
            .from('firm_accounts')
            .update({ current_balance: newBalance })
            .eq('id', cheque.firm_account_id);

          if (balanceError) throw balanceError;
        }

        // Create firm transaction record
        await supabase.from('firm_transactions').insert({
          firm_account_id: cheque.firm_account_id,
          amount: cheque.amount,
          transaction_type: cheque.type === 'received' ? 'income' : 'expense',
          transaction_sub_type: 'cheque',
          description: `Cheque ${cheque.cheque_number} ${status}`,
          transaction_date: format(clearedDate || new Date(), 'yyyy-MM-dd'),
          mahajan_id: cheque.mahajan_id,
        });
      }

      // If cheque status CHANGED to bounced and has bounce charges, deduct from firm account
      if (status === 'bounced' && originalStatus !== 'bounced' && parseFloat(bounceCharges) > 0 && cheque.firm_account_id) {
        const { data: accountData } = await supabase
          .from('firm_accounts')
          .select('current_balance')
          .eq('id', cheque.firm_account_id)
          .single();

        if (accountData) {
          const newBalance = accountData.current_balance - parseFloat(bounceCharges);

          await supabase
            .from('firm_accounts')
            .update({ current_balance: newBalance })
            .eq('id', cheque.firm_account_id);
        }

        // Create transaction for bounce charges
        await supabase.from('firm_transactions').insert({
          firm_account_id: cheque.firm_account_id,
          amount: parseFloat(bounceCharges),
          transaction_type: 'expense',
          transaction_sub_type: 'bounce_charges',
          description: `Bounce charges for cheque ${cheque.cheque_number}`,
          transaction_date: format(new Date(), 'yyyy-MM-dd'),
        });
      }

      toast.success('Cheque updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error updating cheque: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Edit Cheque - {cheque.cheque_number}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-120px)] px-6">
          <form id="edit-cheque-form" onSubmit={handleSubmit} className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing (Sent to Bank)</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(status === 'cleared' || status === 'processing') && (
              <div className="space-y-2">
                <Label htmlFor="bankTransactionId">
                  Bank Transaction ID {status === 'cleared' && '*'}
                </Label>
                <Input
                  id="bankTransactionId"
                  value={bankTransactionId}
                  onChange={(e) => setBankTransactionId(e.target.value)}
                  placeholder="Enter bank transaction ID"
                />
              </div>
            )}

            {status === 'cleared' && (
              <div className="space-y-2">
                <Label>Cleared Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !clearedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {clearedDate ? format(clearedDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={clearedDate}
                      onSelect={setClearedDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {status === 'bounced' && (
              <div className="space-y-2">
                <Label htmlFor="bounceCharges">Bounce Charges</Label>
                <Input
                  id="bounceCharges"
                  type="number"
                  step="0.01"
                  value={bounceCharges}
                  onChange={(e) => setBounceCharges(e.target.value)}
                  placeholder="Enter bounce charges"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any notes"
                rows={3}
              />
            </div>

            <div className="p-4 bg-muted rounded-md space-y-2">
              <h4 className="font-medium">Cheque Details</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">₹{cheque.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank:</span>
                  <span>{cheque.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{new Date(cheque.cheque_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </form>
        </ScrollArea>

        <div className="flex gap-2 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="edit-cheque-form" disabled={loading} className="flex-1">
            {loading ? 'Updating...' : 'Update Cheque'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
