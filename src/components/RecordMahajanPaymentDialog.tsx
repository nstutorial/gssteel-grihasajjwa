import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Partner {
  id: string;
  name: string;
}

interface FirmAccount {
  id: string;
  account_name: string;
  current_balance: number;
}

interface RecordMahajanPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mahajanId: string;
  mahajanName: string;
  outstandingBalance: number;
  onPaymentRecorded: () => void;
}

export function RecordMahajanPaymentDialog({
  open,
  onOpenChange,
  mahajanId,
  mahajanName,
  outstandingBalance,
  onPaymentRecorded,
}: RecordMahajanPaymentDialogProps) {
  const { user } = useAuth();
  const [sourceType, setSourceType] = useState<'partner' | 'firm'>('partner');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [firmAccounts, setFirmAccounts] = useState<FirmAccount[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank'>('cash');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeError, setChequeError] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchPartners();
      fetchFirmAccounts();
    }
  }, [open, user]);

  useEffect(() => {
    if (paymentMode !== 'bank') {
      setChequeNo('');
      setChequeError('');
    }
  }, [paymentMode]);

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name')
      .eq('user_id', user?.id)
      .order('name');

    if (error) {
      console.error('Error fetching partners:', error);
      return;
    }

    setPartners(data || []);
  };

  const fetchFirmAccounts = async () => {
    const { data, error } = await supabase
      .from('firm_accounts')
      .select('id, account_name, current_balance')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('account_name');

    if (error) {
      console.error('Error fetching firm accounts:', error);
      return;
    }

    setFirmAccounts(data || []);
  };

  const checkDuplicateCheque = async (chequeNumber: string): Promise<boolean> => {
    if (!chequeNumber.trim()) return false;
    
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSourceId || !amount || parseFloat(amount) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (paymentMode === 'bank' && chequeNo.trim()) {
      const isDuplicate = await checkDuplicateCheque(chequeNo);
      if (isDuplicate) {
        setChequeError('This cheque number already exists');
        toast.error('Duplicate cheque number found');
        return;
      }
      setChequeError('');
    }

    setLoading(true);

    try {
      const paymentAmount = parseFloat(amount);
      
      // Build notes with cheque info
      let finalNotes = notes;
      if (paymentMode === 'bank' && chequeNo.trim()) {
        finalNotes = `Cheque #${chequeNo.trim()}${notes ? ' - ' + notes : ''}`;
      }
      const originalNotes = notes;
      // Temporarily set notes for payment handlers
      setNotes(finalNotes);

      if (sourceType === 'partner') {
        await handlePartnerPayment(paymentAmount, finalNotes);
      } else {
        await handleFirmAccountPayment(paymentAmount, finalNotes);
      }

      setNotes(originalNotes);
      toast.success('Payment recorded successfully');
      onPaymentRecorded();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerPayment = async (paymentAmount: number, finalNotes: string) => {
    const partner = partners.find(p => p.id === selectedSourceId);
    
    if (outstandingBalance <= 0 || paymentAmount > outstandingBalance) {
      const advanceAmount = outstandingBalance <= 0 ? paymentAmount : paymentAmount - outstandingBalance;
      
      const notesText = finalNotes 
        ? `Overpayment from partner payment FROM ${partner?.name} - ${finalNotes}`
        : `Overpayment from partner payment FROM ${partner?.name}`;

      const { error: advanceError } = await supabase
        .from('advance_payment_transactions')
        .insert({
          user_id: user?.id,
          mahajan_id: mahajanId,
          amount: advanceAmount,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          notes: notesText,
        });

      if (advanceError) throw advanceError;

      const { data: currentMahajan } = await supabase
        .from('mahajans')
        .select('advance_payment')
        .eq('id', mahajanId)
        .single();

      const { error: mahajanError } = await supabase
        .from('mahajans')
        .update({
          advance_payment: (currentMahajan?.advance_payment || 0) + advanceAmount,
        })
        .eq('id', mahajanId);

      if (mahajanError) throw mahajanError;
    }

    const { error: partnerTxnError } = await supabase
      .from('partner_transactions')
      .insert({
        partner_id: selectedSourceId,
        mahajan_id: mahajanId,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        notes: finalNotes || `Payment to ${mahajanName}`,
      });

    if (partnerTxnError) throw partnerTxnError;
  };

  const handleFirmAccountPayment = async (paymentAmount: number, finalNotes: string) => {
    const firmAccount = firmAccounts.find(f => f.id === selectedSourceId);
    
    if (firmAccount && firmAccount.current_balance < paymentAmount) {
      throw new Error('Insufficient balance in firm account');
    }

    const { error: firmTxnError } = await supabase
      .from('firm_transactions')
      .insert({
        firm_account_id: selectedSourceId,
        mahajan_id: mahajanId,
        amount: -paymentAmount,
        transaction_type: 'Payment to Mahajan',
        transaction_date: paymentDate,
        description: finalNotes || `Payment to ${mahajanName}`,
      });

    if (firmTxnError) throw firmTxnError;

    const { error: updateError } = await supabase
      .from('firm_accounts')
      .update({
        current_balance: firmAccount!.current_balance - paymentAmount,
      })
      .eq('id', selectedSourceId);

    if (updateError) throw updateError;

    if (outstandingBalance <= 0 || paymentAmount > outstandingBalance) {
      const advanceAmount = outstandingBalance <= 0 ? paymentAmount : paymentAmount - outstandingBalance;
      
      const notesText = finalNotes 
        ? `Overpayment from firm account FROM ${firmAccount?.account_name} - ${finalNotes}`
        : `Overpayment from firm account FROM ${firmAccount?.account_name}`;

      const { error: advanceError } = await supabase
        .from('advance_payment_transactions')
        .insert({
          user_id: user?.id,
          mahajan_id: mahajanId,
          amount: advanceAmount,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          notes: notesText,
        });

      if (advanceError) throw advanceError;

      const { data: currentMahajan } = await supabase
        .from('mahajans')
        .select('advance_payment')
        .eq('id', mahajanId)
        .single();

      const { error: mahajanError } = await supabase
        .from('mahajans')
        .update({
          advance_payment: (currentMahajan?.advance_payment || 0) + advanceAmount,
        })
        .eq('id', mahajanId);

      if (mahajanError) throw mahajanError;
    }
  };

  const resetForm = () => {
    setSourceType('partner');
    setSelectedSourceId('');
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('cash');
    setChequeNo('');
    setChequeError('');
    setNotes('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
    }
  };

  const selectedFirmAccount = firmAccounts.find(f => f.id === selectedSourceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Record Payment to {mahajanName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[calc(85vh-120px)] px-6">
          <form id="payment-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label>Payment Source Type</Label>
            <Select value={sourceType} onValueChange={(value: 'partner' | 'firm') => {
              setSourceType(value);
              setSelectedSourceId('');
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="firm">Firm Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{sourceType === 'partner' ? 'Select Partner' : 'Select Firm Account'}</Label>
            <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${sourceType === 'partner' ? 'partner' : 'firm account'}`} />
              </SelectTrigger>
              <SelectContent>
                {sourceType === 'partner' ? (
                  partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))
                ) : (
                  firmAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} (Balance: ₹{account.current_balance.toFixed(2)})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedFirmAccount && (
            <div className="p-2 bg-muted rounded text-sm">
              Available Balance: ₹{selectedFirmAccount.current_balance.toFixed(2)}
            </div>
          )}

          <div className="space-y-2">
            <Label>Outstanding Balance</Label>
            <div className="p-2 bg-muted rounded text-sm font-medium">
              ₹{outstandingBalance.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
            />
            {parseFloat(amount) > outstandingBalance && outstandingBalance > 0 && (
              <p className="text-sm text-yellow-600">
                Overpayment of ₹{(parseFloat(amount) - outstandingBalance).toFixed(2)} will be recorded as advance
              </p>
            )}
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
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={(value: 'cash' | 'bank') => setPaymentMode(value)}>
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
              placeholder="Additional notes (optional)"
              rows={3}
            />
          </div>

          </form>
        </ScrollArea>
        <div className="flex gap-2 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={loading} className="flex-1">
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
