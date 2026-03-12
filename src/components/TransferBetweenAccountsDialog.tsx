import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FirmAccount {
  id: string;
  account_name: string;
}

interface TransferBetweenAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromAccountId: string;
  fromAccountName: string;
  onTransferComplete: () => void;
}

export function TransferBetweenAccountsDialog({
  open,
  onOpenChange,
  fromAccountId,
  fromAccountName,
  onTransferComplete
}: TransferBetweenAccountsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<FirmAccount[]>([]);
  const [formData, setFormData] = useState({
    to_account_id: '',
    amount: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open, fromAccountId]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_accounts')
        .select('id, account_name')
        .neq('id', fromAccountId)
        .eq('is_active', true)
        .order('account_name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.to_account_id) {
      toast.error('Please select a destination account');
      return;
    }

    setLoading(true);
    try {
      const amount = parseFloat(formData.amount);
      const toAccountName = accounts.find(a => a.id === formData.to_account_id)?.account_name || 'account';

      // Create debit transaction for source account
      const { error: debitError } = await supabase
        .from('firm_transactions')
        .insert({
          firm_account_id: fromAccountId,
          transaction_type: 'expense',
          transaction_sub_type: 'transfer_out',
          amount: amount,
          transaction_date: formData.transfer_date,
          description: `Transfer to ${toAccountName}: ${formData.notes || 'Money transfer'}`
        });

      if (debitError) throw debitError;

      // Create credit transaction for destination account
      const { error: creditError } = await supabase
        .from('firm_transactions')
        .insert({
          firm_account_id: formData.to_account_id,
          transaction_type: 'income',
          transaction_sub_type: 'transfer_in',
          amount: amount,
          transaction_date: formData.transfer_date,
          description: `Transfer from ${fromAccountName}: ${formData.notes || 'Money transfer'}`
        });

      if (creditError) throw creditError;

      toast.success('Transfer completed successfully');
      onTransferComplete();
      onOpenChange(false);
      setFormData({
        to_account_id: '',
        amount: '',
        transfer_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (error: any) {
      console.error('Error processing transfer:', error);
      toast.error('Failed to complete transfer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Money Between Accounts</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>From Account</Label>
            <Input value={fromAccountName} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to_account_id">To Account *</Label>
            <Select
              value={formData.to_account_id}
              onValueChange={(value) => setFormData({ ...formData, to_account_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer_date">Transfer Date *</Label>
            <Input
              id="transfer_date"
              type="date"
              value={formData.transfer_date}
              onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional transfer notes..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Transfer Money'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
