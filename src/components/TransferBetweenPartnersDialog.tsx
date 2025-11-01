import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Partner {
  id: string;
  name: string;
}

interface TransferBetweenPartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromPartnerId: string;
  fromPartnerName: string;
  onTransferComplete: () => void;
}

export function TransferBetweenPartnersDialog({
  open,
  onOpenChange,
  fromPartnerId,
  fromPartnerName,
  onTransferComplete
}: TransferBetweenPartnersDialogProps) {
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [formData, setFormData] = useState({
    to_partner_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank',
    notes: ''
  });

  useEffect(() => {
    if (open) {
      fetchPartners();
    }
  }, [open, fromPartnerId]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .neq('id', fromPartnerId)
        .order('name');

      if (error) throw error;
      setPartners(data || []);
    } catch (error: any) {
      console.error('Error fetching partners:', error);
      toast.error('Failed to load partners');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.to_partner_id) {
      toast.error('Please select a partner to transfer to');
      return;
    }

    setLoading(true);
    try {
      const amount = parseFloat(formData.amount);

      // Create withdrawal transaction for source partner
      const { error: withdrawalError } = await supabase
        .from('partner_transactions')
        .insert({
          partner_id: fromPartnerId,
          amount: amount,
          payment_date: formData.payment_date,
          payment_mode: formData.payment_mode,
          notes: `Transfer/Paid to ${partners.find(p => p.id === formData.to_partner_id)?.name || 'partner'}: ${formData.notes || 'Money transfer'}`
        });

      if (withdrawalError) throw withdrawalError;

      // Create deposit transaction for destination partner
      const { error: depositError } = await supabase
        .from('partner_transactions')
        .insert({
          partner_id: formData.to_partner_id,
          amount: -amount,
          payment_date: formData.payment_date,
          payment_mode: formData.payment_mode,
          notes: `Transfer/Paid from ${fromPartnerName}: ${formData.notes || 'Money transfer'}`
        });

      if (depositError) throw depositError;

      toast.success('Transfer completed successfully');
      onTransferComplete();
      onOpenChange(false);
      setFormData({
        to_partner_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'bank',
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
          <DialogTitle>Transfer Money Between Partners</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>From Partner</Label>
            <Input value={fromPartnerName} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to_partner_id">To Partner *</Label>
            <Select
              value={formData.to_partner_id}
              onValueChange={(value) => setFormData({ ...formData, to_partner_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
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
            <Label htmlFor="payment_date">Transfer Date *</Label>
            <Input
              id="payment_date"
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_mode">Payment Mode *</Label>
            <Select
              value={formData.payment_mode}
              onValueChange={(value) => setFormData({ ...formData, payment_mode: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
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
