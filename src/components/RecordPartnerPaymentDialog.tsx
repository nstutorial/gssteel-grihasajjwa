import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Mahajan {
  id: string;
  name: string;
}

interface RecordPartnerPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  onPaymentAdded: () => void;
}

export function RecordPartnerPaymentDialog({ 
  open, 
  onOpenChange, 
  partnerId,
  onPaymentAdded 
}: RecordPartnerPaymentDialogProps) {
  const [mahajans, setMahajans] = useState<Mahajan[]>([]);
  const [mahajanId, setMahajanId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMahajans();
    }
  }, [open]);

  const fetchMahajans = async () => {
    try {
      const { data, error } = await supabase
        .from('mahajans')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setMahajans(data || []);
    } catch (error: any) {
      console.error('Error fetching mahajans:', error);
      toast.error('Failed to load mahajans');
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

      // Insert transaction
      const { error: transactionError } = await supabase
        .from('partner_transactions')
        .insert({
          partner_id: partnerId,
          mahajan_id: mahajanId,
          amount: amountNum,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          notes,
        });

      if (transactionError) throw transactionError;

      // Update partner's total invested
      const { data: currentPartner } = await supabase
        .from('partners')
        .select('total_invested')
        .eq('id', partnerId)
        .single();

      if (currentPartner) {
        const { error: updateError } = await supabase
          .from('partners')
          .update({ total_invested: (currentPartner.total_invested || 0) + amountNum })
          .eq('id', partnerId);

        if (updateError) throw updateError;
      }

      // Get partner and mahajan names for better tracking
      const { data: partnerData } = await supabase
        .from('partners')
        .select('name')
        .eq('id', partnerId)
        .single();

      const { data: mahajanData } = await supabase
        .from('mahajans')
        .select('name')
        .eq('id', mahajanId)
        .single();

      const partnerName = partnerData?.name || 'Partner';
      const mahajanName = mahajanData?.name || 'Mahajan';

      // Handle mahajan payment: reduce outstanding bills or add to advance payment
      const { data: activeBills } = await supabase
        .from('bills')
        .select('id, bill_amount')
        .eq('mahajan_id', mahajanId)
        .eq('is_active', true)
        .order('bill_date', { ascending: true });

      let remainingAmount = amountNum;

      // First, try to pay off active bills
      if (activeBills && activeBills.length > 0) {
        for (const bill of activeBills) {
          if (remainingAmount <= 0) break;

          // Get total paid for this bill
          const { data: transactions } = await supabase
            .from('bill_transactions')
            .select('amount')
            .eq('bill_id', bill.id);

          const totalPaid = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
          const billOutstanding = bill.bill_amount - totalPaid;

          if (billOutstanding > 0) {
            const paymentForBill = Math.min(remainingAmount, billOutstanding);
            
            // Map payment mode to enum values (cash or bank)
            const billPaymentMode = paymentMode === 'cash' ? 'cash' : 'bank';
            
            // Record bill transaction
            const { error: billTxError } = await supabase
              .from('bill_transactions')
              .insert({
                bill_id: bill.id,
                amount: paymentForBill,
                transaction_type: 'principal',
                payment_date: paymentDate,
                payment_mode: billPaymentMode,
                notes: `Payment from partner: ${partnerName}${notes ? ' - ' + notes : ''}`,
              });

            if (billTxError) throw billTxError;

            remainingAmount -= paymentForBill;

            // Mark bill as inactive if fully paid
            if (paymentForBill >= billOutstanding) {
              await supabase
                .from('bills')
                .update({ is_active: false })
                .eq('id', bill.id);
            }
          }
        }
      }

      // If there's remaining amount, add to mahajan's advance payment
      if (remainingAmount > 0) {
        const { data: mahajan } = await supabase
          .from('mahajans')
          .select('advance_payment')
          .eq('id', mahajanId)
          .single();

        if (mahajan) {
          await supabase
            .from('mahajans')
            .update({ advance_payment: (mahajan.advance_payment || 0) + remainingAmount })
            .eq('id', mahajanId);
        }
      }

      toast.success('Payment recorded successfully');
      setMahajanId('');
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
          <DialogTitle>Record Partner Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="mahajan">Mahajan *</Label>
            <Select value={mahajanId} onValueChange={setMahajanId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select mahajan" />
              </SelectTrigger>
              <SelectContent>
                {mahajans.map((mahajan) => (
                  <SelectItem key={mahajan.id} value={mahajan.id}>
                    {mahajan.name}
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
            <Label htmlFor="paymentMode">Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>
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
              {loading ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
