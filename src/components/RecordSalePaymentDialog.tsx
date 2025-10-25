import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const paymentSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_mode: z.enum(['cash', 'bank']),
  transaction_type: z.enum(['payment', 'refund']).default('payment'),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface Sale {
  id: string;
  sale_number: string;
  sale_amount: number;
  outstanding: number;
}

interface RecordSalePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: { id: string; name: string; outstanding: number } | null;
  onPaymentRecorded: () => void;
}

export function RecordSalePaymentDialog({
  open,
  onOpenChange,
  customer,
  onPaymentRecorded,
}: RecordSalePaymentDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      transaction_type: 'payment',
      notes: '',
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    if (!user || !customer) {
      toast.error('Please select a customer');
      return;
    }

    const paymentAmount = parseFloat(data.amount);
    if (paymentAmount > customer.outstanding) {
      toast.error(`Payment amount cannot exceed outstanding amount of ₹${customer.outstanding.toFixed(2)}`);
      return;
    }

    if (paymentAmount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      // Fetch all unpaid sales for this customer, ordered by date (oldest first)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.id)
        .eq('bill_customer_id', customer.id)
        .eq('is_active', true)
        .order('sale_date', { ascending: true });

      if (salesError) throw salesError;

      if (!salesData || salesData.length === 0) {
        toast.error('No active sales found for this customer');
        return;
      }

      // Get all transactions for these sales
      const saleIds = salesData.map(s => s.id);
      const { data: transData } = await supabase
        .from('sale_transactions')
        .select('*')
        .in('sale_id', saleIds);

      // Calculate outstanding for each sale
      const salesWithOutstanding = salesData.map(sale => {
        const transactions = transData?.filter(t => t.sale_id === sale.id) || [];
        const totalPaid = transactions
          .filter(t => t.transaction_type === 'payment')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const totalRefund = transactions
          .filter(t => t.transaction_type === 'refund')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const outstanding = Number(sale.sale_amount) - totalPaid + totalRefund;

        return { ...sale, outstanding };
      }).filter(s => s.outstanding > 0);

      // Apply payment to sales (oldest first)
      let remainingPayment = paymentAmount;
      const transactionsToInsert = [];

      for (const sale of salesWithOutstanding) {
        if (remainingPayment <= 0) break;

        const amountToApply = Math.min(remainingPayment, sale.outstanding);
        transactionsToInsert.push({
          sale_id: sale.id,
          amount: amountToApply,
          payment_date: data.payment_date,
          payment_mode: data.payment_mode,
          transaction_type: data.transaction_type,
          notes: data.notes || null,
        });

        remainingPayment -= amountToApply;
      }

      // Insert all transactions
      const { error: insertError } = await supabase
        .from('sale_transactions')
        .insert(transactionsToInsert);

      if (insertError) throw insertError;

      // Update customer outstanding amount
      const newOutstanding = customer.outstanding - paymentAmount;
      await supabase
        .from('bill_customers')
        .update({ outstanding_amount: Math.max(0, newOutstanding) })
        .eq('id', customer.id);

      toast.success('Payment recorded successfully');
      form.reset();
      onOpenChange(false);
      onPaymentRecorded();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment for {customer?.name}</DialogTitle>
        </DialogHeader>

        {customer && (
          <div className="bg-muted p-3 rounded-md">
            <div className="text-sm text-muted-foreground">Outstanding Balance</div>
            <div className="text-2xl font-bold">₹{customer.outstanding.toFixed(2)}</div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter amount"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Mode *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any notes"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
