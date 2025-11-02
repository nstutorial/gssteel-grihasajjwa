import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  transaction_date: string;
}

interface EditFirmTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onTransactionUpdated: () => void;
}

interface CustomTransactionType {
  id: string;
  name: string;
}

export function EditFirmTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onTransactionUpdated
}: EditFirmTransactionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [customTypes, setCustomTypes] = useState<CustomTransactionType[]>([]);
  const [formData, setFormData] = useState({
    transaction_type: '',
    amount: '',
    description: '',
    transaction_date: ''
  });

  useEffect(() => {
    if (transaction && open) {
      setFormData({
        transaction_type: transaction.transaction_type,
        amount: transaction.amount.toString(),
        description: transaction.description || '',
        transaction_date: transaction.transaction_date
      });
    }
  }, [transaction, open]);

  useEffect(() => {
    if (open) {
      fetchCustomTypes();
    }
  }, [open]);

  const fetchCustomTypes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('custom_transaction_types')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      
      // Standard transaction type values to avoid duplicates
      const standardTypes = [
        'partner_deposit', 'partner_withdrawal', 'refund', 'expense', 
        'income', 'adjustment', 'gst_tax_payment', 'income_tax_payment', 
        'paid_to_ca', 'paid_to_supplier'
      ];
      
      // Filter out custom types that would conflict with standard types
      const filteredTypes = (data || []).filter(type => {
        const slug = type.name.toLowerCase().replace(/\s+/g, '_');
        return !standardTypes.includes(slug);
      });
      
      setCustomTypes(filteredTypes);
    } catch (error: any) {
      console.error('Error fetching custom types:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    setLoading(true);
    try {
      // Determine main transaction type and sub-type
      const specificExpenseTypes = ['gst_tax_payment', 'income_tax_payment', 'paid_to_ca', 'paid_to_supplier'];
      const isSpecificExpenseType = specificExpenseTypes.includes(formData.transaction_type);
      const isCustomType = formData.transaction_type.startsWith('custom_');
      
      const dbTransactionType = isSpecificExpenseType || isCustomType ? 'expense' : formData.transaction_type;
      const transactionSubType = isSpecificExpenseType || isCustomType ? formData.transaction_type : null;

      const { error } = await supabase
        .from('firm_transactions')
        .update({
          transaction_type: dbTransactionType,
          transaction_sub_type: transactionSubType,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          transaction_date: formData.transaction_date
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success('Transaction updated successfully');
      onTransactionUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transaction_type">Transaction Type</Label>
            <Select
              value={formData.transaction_type}
              onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner_deposit">Partner Deposit</SelectItem>
                <SelectItem value="partner_withdrawal">Partner Withdrawal</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="gst_tax_payment">GST Tax Payment</SelectItem>
                <SelectItem value="income_tax_payment">Income Tax Payment</SelectItem>
                <SelectItem value="paid_to_ca">Paid To CA</SelectItem>
                <SelectItem value="paid_to_supplier">Paid To Supplier</SelectItem>
                {customTypes.map((type) => (
                  <SelectItem key={type.id} value={type.name.toLowerCase().replace(/\s+/g, '_')}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
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
            <Label htmlFor="transaction_date">Transaction Date</Label>
            <Input
              id="transaction_date"
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
