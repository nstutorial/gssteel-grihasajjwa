import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [chequeNo, setChequeNo] = useState('');
  const [chequeError, setChequeError] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMahajans();
    }
  }, [open]);

  useEffect(() => {
    if (paymentMode !== 'bank') {
      setChequeNo('');
      setChequeError('');
    }
  }, [paymentMode]);

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

  const checkDuplicateCheque = async (chequeNumber: string): Promise<boolean> => {
    if (!chequeNumber.trim()) return false;

    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: existingCheques } = await supabase
      .from('cheques')
      .select('id')
      .eq('user_id', user?.id)
      .eq('cheque_number', chequeNumber.trim());

    if (existingCheques && existingCheques.length > 0) return true;

    const { data: partnerTxns } = await supabase
      .from('partner_transactions')
      .select('id, notes')
      .ilike('notes', `%Cheque #${chequeNumber.trim()}%`);

    if (partnerTxns && partnerTxns.length > 0) return true;

    const { data: firmTxns } = await supabase
      .from('firm_transactions')
      .select('id, description')
      .ilike('description', `%Cheque #${chequeNumber.trim()}%`);

    if (firmTxns && firmTxns.length > 0) return true;

    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
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

      // Duplicate cheque check
      if (paymentMode === 'bank' && chequeNo.trim()) {
        const isDuplicate = await checkDuplicateCheque(chequeNo);
        if (isDuplicate) {
          setChequeError('This cheque number already exists');
          toast.error('Duplicate cheque number found');
          setLoading(false);
          return;
        }
        setChequeError('');
      }

      // Build final notes with cheque info
      let finalNotes = notes;
      if (paymentMode === 'bank' && chequeNo.trim()) {
        finalNotes = `Cheque #${chequeNo.trim()}${notes ? ' - ' + notes : ''}`;
      }

      // Map payment mode for DB (only cash/bank allowed)
      const dbPaymentMode = paymentMode === 'cash' ? 'cash' : 'bank';

      // Insert transaction
      const { error: transactionError } = await supabase
        .from('partner_transactions')
        .insert({
          partner_id: partnerId,
          mahajan_id: mahajanId,
          amount: amountNum,
          payment_date: paymentDate,
          payment_mode: dbPaymentMode,
          notes: finalNotes,
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

      // Handle mahajan payment: reduce outstanding bills or add to advance payment
      const { data: activeBills } = await supabase
        .from('bills')
        .select('id, bill_amount')
        .eq('mahajan_id', mahajanId)
        .eq('is_active', true)
        .order('bill_date', { ascending: true });

      let remainingAmount = amountNum;
      let billsPaid = 0;

      // First, try to pay off active bills (if any exist)
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
            
            const billPaymentMode = dbPaymentMode === 'cash' ? 'cash' : 'bank';
            
            const { error: billTxError } = await supabase
              .from('bill_transactions')
              .insert({
                bill_id: bill.id,
                amount: paymentForBill,
                transaction_type: 'principal',
                payment_date: paymentDate,
                payment_mode: billPaymentMode,
                notes: `Payment from partner: ${partnerName}${finalNotes ? ' - ' + finalNotes : ''}`,
              });

            if (billTxError) throw billTxError;

            remainingAmount -= paymentForBill;
            billsPaid++;

            if (paymentForBill >= billOutstanding) {
              await supabase
                .from('bills')
                .update({ is_active: false })
                .eq('id', bill.id);
            }
          }
        }
      }

      // Add remaining amount to mahajan's advance payment
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
          
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('advance_payment_transactions' as any)
                .insert({
                  user_id: user.id,
                  mahajan_id: mahajanId,
                  amount: remainingAmount,
                  payment_date: paymentDate,
                  payment_mode: dbPaymentMode as 'cash' | 'bank',
                  notes: `Overpayment from partner payment - FROM ${partnerName}${finalNotes ? ' - ' + finalNotes : ''}`,
                });
            }
          } catch (err) {
            console.log('Advance payment transaction table not available yet');
          }
        }
      }

      // Show appropriate success message
      if (billsPaid > 0 && remainingAmount > 0) {
        toast.success(`Payment recorded: ${billsPaid} bill(s) paid, ₹${remainingAmount.toFixed(2)} added to advance`);
      } else if (billsPaid > 0) {
        toast.success(`Payment recorded: ${billsPaid} bill(s) paid`);
      } else {
        toast.success(`Payment recorded: ₹${amountNum.toFixed(2)} added to advance (no active bills)`);
      }
      
      setMahajanId('');
      setAmount('');
      setNotes('');
      setChequeNo('');
      setChequeError('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('cash');
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
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Record Partner Payment</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[calc(85vh-120px)] px-6">
          <form id="partner-payment-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4 pb-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMode">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMode === 'bank' && (
              <div className="space-y-2">
                <Label htmlFor="chequeNo">Cheque No. (Optional)</Label>
                <Input
                  id="chequeNo"
                  value={chequeNo}
                  onChange={(e) => {
                    setChequeNo(e.target.value);
                    setChequeError('');
                  }}
                  placeholder="Enter cheque number"
                />
                {chequeError && (
                  <p className="text-sm text-destructive">{chequeError}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </form>
        </ScrollArea>
        <div className="flex gap-2 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="partner-payment-form" disabled={loading} className="flex-1">
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
