import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FirmAccount {
  id: string;
  account_name: string;
  account_type: string;
  current_balance: number;
}

interface ReceiveMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  onPaymentAdded: () => void;
}

export function ReceiveMoneyDialog({ 
  open, 
  onOpenChange, 
  partnerId,
  partnerName,
  onPaymentAdded 
}: ReceiveMoneyDialogProps) {
  const [firmAccounts, setFirmAccounts] = useState<FirmAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFirmAccounts();
    }
  }, [open]);

  const fetchFirmAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_accounts')
        .select('id, account_name, account_type, current_balance')
        .eq('is_active', true)
        .order('account_name');

      if (error) throw error;
      setFirmAccounts(data || []);
    } catch (error: any) {
      console.error('Error fetching firm accounts:', error);
      toast.error('Failed to load firm accounts');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // Get firm account details
      const { data: firmAccount } = await supabase
        .from('firm_accounts')
        .select('current_balance')
        .eq('id', accountId)
        .single();

      if (!firmAccount) {
        toast.error('Firm account not found');
        return;
      }

      if (firmAccount.current_balance < amountNum) {
        toast.error('Insufficient balance in firm account');
        return;
      }

      // Create firm transaction (withdrawal for partner)
      const { error: firmTxError } = await supabase
        .from('firm_transactions')
        .insert({
          firm_account_id: accountId,
          transaction_type: 'partner_withdrawal',
          amount: amountNum,
          partner_id: partnerId,
          description: `Payment to partner: ${partnerName}${notes ? ' - ' + notes : ''}`,
          transaction_date: paymentDate,
        });

      if (firmTxError) throw firmTxError;

      // Update firm account balance
      const { error: updateFirmError } = await supabase
        .from('firm_accounts')
        .update({ current_balance: firmAccount.current_balance - amountNum })
        .eq('id', accountId);

      if (updateFirmError) throw updateFirmError;

      // Create partner transaction (negative transaction - receiving money)
      const { error: partnerTxError } = await supabase
        .from('partner_transactions')
        .insert({
          partner_id: partnerId,
          mahajan_id: null,
          amount: -amountNum,
          payment_date: paymentDate,
          payment_mode: 'bank',
          notes: `Received from firm account${notes ? ' - ' + notes : ''}`,
        });

      if (partnerTxError) throw partnerTxError;

      // Update partner's total invested (deduct the amount)
      const { data: currentPartner } = await supabase
        .from('partners')
        .select('total_invested')
        .eq('id', partnerId)
        .single();

      if (currentPartner) {
        const { error: updatePartnerError } = await supabase
          .from('partners')
          .update({ total_invested: (currentPartner.total_invested || 0) - amountNum })
          .eq('id', partnerId);

        if (updatePartnerError) throw updatePartnerError;
      }

      toast.success('Payment recorded successfully');
      setAccountId('');
      setAmount('');
      setNotes('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      onOpenChange(false);
      onPaymentAdded();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Money from Firm Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="account">Firm Account *</Label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select firm account" />
              </SelectTrigger>
              <SelectContent>
                {firmAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name} ({account.account_type}) - Balance: ₹{account.current_balance.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording...' : 'Receive Money'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
