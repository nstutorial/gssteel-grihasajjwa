import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useControl } from '@/contexts/ControlContext';
import { supabase } from '@/integrations/supabase/client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import MahajanStatement from './MahajanStatement';
import AddBillDialog from './AddBillDialog';
import SearchBillbyRef from './SearchBillbyRef';
import SearchTransactionById from './SearchTransactionById';

interface Mahajan {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
}

interface Bill {
  id: string;
  bill_amount: number;
  interest_rate: number | null;
  interest_type: string | null;
  bill_date: string;
  due_date: string | null;
  description: string | null;
  is_active: boolean | null;
}

interface BillTransaction {
  id: string;
  bill_id: string;
  amount: number;
  payment_date: string;
  transaction_type: string;
  payment_mode: string;
  notes: string | null;
  bill: {
    description: string | null;
    bill_amount: number;
  };
}

interface MahajanDetailsProps {
  mahajan: Mahajan;
  onBack: () => void;
  onUpdate?: () => void;
}

const MahajanDetails: React.FC<MahajanDetailsProps> = ({ mahajan, onBack, onUpdate }) => {
  const { user } = useAuth();
  const { settings: controlSettings } = useControl();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [transactions, setTransactions] = useState<BillTransaction[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState('');
  const [loading, setLoading] = useState(false);
  const [addBillDialogOpen, setAddBillDialogOpen] = useState(false);

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    payment_mode: 'cash' as 'cash' | 'bank',
  });

  // Fetch bills and transactions together to prevent flickering
  useEffect(() => {
    if (user) fetchBillsAndTransactions();
  }, [user, mahajan.id]);

  // Listen for refresh events (when bills/transactions are edited)
  useEffect(() => {
    const handleRefresh = () => {
      fetchBillsAndTransactions();
    };

    window.addEventListener('refresh-mahajans', handleRefresh);
    return () => window.removeEventListener('refresh-mahajans', handleRefresh);
  }, [user, mahajan.id]);

  const fetchBillsAndTransactions = async () => {
    try {
      setLoading(true);
      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('mahajan_id', mahajan.id)
        .eq('user_id', user?.id)
        .order('bill_date', { ascending: false });

      if (billsError) throw billsError;

      let transData: any[] = [];
      if (billsData && billsData.length > 0) {
        const { data: transactions, error: transError } = await supabase
          .from('bill_transactions')
          .select(`*, bill:bills(description, bill_amount)`)
          .in('bill_id', billsData.map(b => b.id))
          .order('payment_date', { ascending: false });

        if (transError) throw transError;
        transData = transactions || [];
      }

      // Set both states together to prevent flickering
      setTransactions(transData);
      setBills(billsData || []);
    } catch (error: any) {
      console.error('Error fetching bills and transactions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch bills and transactions',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateBillBalance = (billId: string) => {
    const billTransactions = transactions.filter(t => t.bill_id === billId);
    const totalPaid = billTransactions.reduce((sum, t) => sum + t.amount, 0);
    const bill = bills.find(b => b.id === billId);
    return bill ? bill.bill_amount - totalPaid : 0;
  };

  const calculateInterest = (bill: Bill, balance: number) => {
    if (!bill.interest_rate || bill.interest_type === 'none') return 0;
    
    const rate = bill.interest_rate / 100;
    const startDate = new Date(bill.bill_date);
    const endDate = new Date();
    
    if (bill.interest_type === 'daily') {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (bill.interest_type === 'monthly') {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30;
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateTotalOutstanding = () => {
    return bills.reduce((sum, bill) => {
      const balance = calculateBillBalance(bill.id);
      const interest = calculateInterest(bill, balance);
      return sum + balance + interest;
    }, 0);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const paymentAmount = parseFloat(paymentData.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
      });
      return;
    }

    setLoading(true);
    try {
      // Get all active bills sorted by bill_date (oldest first)
      const activeBills = bills
        .filter(b => b.is_active)
        .sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());

      if (activeBills.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Active Bills',
          description: 'There are no active bills to pay',
        });
        return;
      }

      let remainingPayment = paymentAmount;
      const transactionsToInsert: any[] = [];

      // Process each bill sequentially
      for (const bill of activeBills) {
        if (remainingPayment <= 0) break;

        const balance = calculateBillBalance(bill.id);
        const interest = calculateInterest(bill, balance);
        const totalBillOutstanding = balance + interest;

        if (totalBillOutstanding <= 0) continue;

        // Pay interest first
        if (interest > 0 && remainingPayment > 0) {
          const interestPayment = Math.min(interest, remainingPayment);
          transactionsToInsert.push({
            bill_id: bill.id,
            amount: interestPayment,
            transaction_type: 'interest',
            payment_mode: paymentData.payment_mode,
            payment_date: paymentData.payment_date,
            notes: paymentData.notes || null,
          });
          remainingPayment -= interestPayment;
        }

        // Then pay principal
        if (balance > 0 && remainingPayment > 0) {
          const principalPayment = Math.min(balance, remainingPayment);
          transactionsToInsert.push({
            bill_id: bill.id,
            amount: principalPayment,
            transaction_type: 'principal',
            payment_mode: paymentData.payment_mode,
            payment_date: paymentData.payment_date,
            notes: paymentData.notes || null,
          });
          remainingPayment -= principalPayment;
        }
      }

      // Insert all transactions
      const { error } = await supabase
        .from('bill_transactions')
        .insert(transactionsToInsert);

      if (error) throw error;

      toast({
        title: 'Payment recorded',
        description: `Payment of ${formatCurrency(paymentAmount)} has been distributed across bills`,
      });

      setPaymentData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
        payment_mode: 'cash',
      });
      setShowPaymentDialog(false);

      fetchBillsAndTransactions();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record payment',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{mahajan.name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {mahajan.phone && <span>📞 {mahajan.phone}</span>}
              {mahajan.payment_day && <span>📅 {mahajan.payment_day}</span>}
            </div>
          </div>
        </div>
        {controlSettings.allowBillManagement && (
          <div className="flex gap-2">
            <Button onClick={() => setAddBillDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
            <Button onClick={() => setShowPaymentDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.filter(b => b.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(calculateTotalOutstanding())}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bills" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="searchBill">Search Bill</TabsTrigger>
          <TabsTrigger value="searchTransaction">Search Transaction</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {bills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bills found for this mahajan
                </div>
              ) : (
                <div className="space-y-4">
                  {bills.map((bill) => {
                    const balance = calculateBillBalance(bill.id);
                    const interest = calculateInterest(bill, balance);
                    const totalOutstanding = balance + interest;

                    return (
                      <div key={bill.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{bill.description || 'Bill'}</h3>
                              <Badge variant={bill.is_active ? 'default' : 'secondary'}>
                                {bill.is_active ? 'Active' : 'Closed'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Bill Amount:</span>
                                <div className="font-medium">{formatCurrency(bill.bill_amount)}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Bill Date:</span>
                                <div className="font-medium">{formatDate(bill.bill_date)}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Balance:</span>
                                <div className="font-medium">{formatCurrency(balance)}</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Interest:</span>
                                <div className="font-medium">{formatCurrency(interest)}</div>
                              </div>
                            </div>
                            {totalOutstanding > 0 && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">Total Outstanding:</span>
                                <span className="font-bold text-red-600 ml-2">{formatCurrency(totalOutstanding)}</span>
                              </div>
                            )}
                          </div>
                          {controlSettings.allowBillManagement && bill.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBillId(bill.id);
                                setShowPaymentDialog(true);
                              }}
                            >
                              Record Payment
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statement">
          <MahajanStatement mahajan={mahajan} />
        </TabsContent>

        <TabsContent value="searchBill">
          <SearchBillbyRef bills={bills as any} />
        </TabsContent>

        <TabsContent value="searchTransaction">
          <SearchTransactionById transactions={transactions as any} />
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Total Outstanding</Label>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(calculateTotalOutstanding())}
              </div>
              <p className="text-sm text-muted-foreground">
                Payment will be applied to bills sequentially (oldest first), clearing interest before principal
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter amount"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select 
                value={paymentData.payment_mode} 
                onValueChange={(value: 'cash' | 'bank') => 
                  setPaymentData({ ...paymentData, payment_mode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Enter notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Recording...' : 'Record Payment'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Bill Dialog */}
      <AddBillDialog
        open={addBillDialogOpen}
        onOpenChange={setAddBillDialogOpen}
        mahajan={mahajan}
        onBillAdded={() => {
          fetchBillsAndTransactions();
          if (onUpdate) onUpdate();
        }}
      />
    </div>
  );
};

export default MahajanDetails;
