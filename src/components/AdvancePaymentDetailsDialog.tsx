import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { IndianRupee, Calendar, User } from 'lucide-react';

interface AdvancePaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mahajanId: string;
  mahajanName: string;
}

interface PartnerTransaction {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string | null;
  partner: {
    name: string;
  } | null;
}

export function AdvancePaymentDetailsDialog({
  open,
  onOpenChange,
  mahajanId,
  mahajanName,
}: AdvancePaymentDetailsDialogProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPartnerTransactions();
    }
  }, [open, mahajanId]);

  const fetchPartnerTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partner_transactions')
        .select(`
          id,
          amount,
          payment_date,
          payment_mode,
          notes,
          partner:partners(name)
        `)
        .eq('mahajan_id', mahajanId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      // Filter out transactions without partner data and type cast
      const validTransactions = (data || []).filter(
        (t): t is PartnerTransaction => t.partner !== null
      );
      setTransactions(validTransactions);
    } catch (error: any) {
      console.error('Error fetching partner transactions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load advance payment details',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advance Payment Details - {mahajanName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No partner payments found for this mahajan.
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700">Total Partner Payments</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Payment History</h4>
              {transactions.map((transaction) => (
                <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {transaction.partner?.name || 'Unknown Partner'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(transaction.payment_date), 'dd MMM yyyy')}
                          </div>
                          <div className="capitalize">
                            {transaction.payment_mode}
                          </div>
                        </div>

                        {transaction.notes && (
                          <div className="text-sm text-muted-foreground italic">
                            {transaction.notes}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                          <IndianRupee className="h-4 w-4" />
                          {formatCurrency(transaction.amount).replace('₹', '')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
