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
  sale_id: z.string().min(1, 'Please select a sale'),
  amount: z.string().min(1, 'Amount is required'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_mode: z.enum(['cash', 'online', 'cheque']),
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
  customer: { id: string; name: string } | null;
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      sale_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      transaction_type: 'payment',
      notes: '',
    },
  });

  // Fetch sales when dialog opens
  useState(() => {
    if (open && customer) {
      fetchCustomerSales();
    }
  });

  const fetchCustomerSales = async () => {
    if (!user || !customer) return;

    setLoadingSales(true);
    try {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', user.id)
        .eq('bill_customer_id', customer.id)
        .eq('is_active', true)
        .order('sale_date', { ascending: false });

      if (salesError) throw salesError;

      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id);
        const { data: transData } = await supabase
          .from('sale_transactions')
          .select('*')
          .in('sale_id', saleIds);

        const salesWithOutstanding = salesData.map(sale => {
          const transactions = transData?.filter(t => t.sale_id === sale.id) || [];
          const totalPaid = transactions
            .filter(t => t.transaction_type === 'payment')
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const totalRefund = transactions
            .filter(t => t.transaction_type === 'refund')
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const outstanding = Number(sale.sale_amount) - totalPaid + totalRefund;

          return {
            id: sale.id,
            sale_number: sale.sale_number || 'N/A',
            sale_amount: Number(sale.sale_amount),
            outstanding,
          };
        });

        setSales(salesWithOutstanding.filter(s => s.outstanding > 0));
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Failed to load sales');
    } finally {
      setLoadingSales(false);
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (!user || !customer) {
      toast.error('Please select a customer');
      return;
    }

    const selectedSale = sales.find(s => s.id === data.sale_id);
    if (!selectedSale) {
      toast.error('Please select a valid sale');
      return;
    }

    const paymentAmount = parseFloat(data.amount);
    if (paymentAmount > selectedSale.outstanding) {
      toast.error(`Payment amount cannot exceed outstanding amount of ₹${selectedSale.outstanding.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('sale_transactions').insert({
        sale_id: data.sale_id,
        amount: paymentAmount,
        payment_date: data.payment_date,
        payment_mode: data.payment_mode,
        transaction_type: data.transaction_type,
        notes: data.notes || null,
      });

      if (error) throw error;

      // Update bill customer outstanding amount
      const { data: allSalesData } = await supabase
        .from('sales')
        .select('id, sale_amount')
        .eq('bill_customer_id', customer.id)
        .eq('is_active', true);

      if (allSalesData) {
        const allSaleIds = allSalesData.map(s => s.id);
        const { data: allTransData } = await supabase
          .from('sale_transactions')
          .select('*')
          .in('sale_id', allSaleIds);

        let totalOutstanding = 0;
        allSalesData.forEach(sale => {
          const transactions = allTransData?.filter(t => t.sale_id === sale.id) || [];
          const totalPaid = transactions
            .filter(t => t.transaction_type === 'payment')
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const totalRefund = transactions
            .filter(t => t.transaction_type === 'refund')
            .reduce((sum, t) => sum + Number(t.amount), 0);
          totalOutstanding += Number(sale.sale_amount) - totalPaid + totalRefund;
        });

        await supabase
          .from('bill_customers')
          .update({ outstanding_amount: totalOutstanding })
          .eq('id', customer.id);
      }

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment for {customer?.name}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sale_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Sale *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sale" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingSales ? (
                        <SelectItem value="loading" disabled>
                          Loading sales...
                        </SelectItem>
                      ) : sales.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No active sales found
                        </SelectItem>
                      ) : (
                        sales.map((sale) => (
                          <SelectItem key={sale.id} value={sale.id}>
                            {sale.sale_number} - Outstanding: ₹{sale.outstanding.toFixed(2)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
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
