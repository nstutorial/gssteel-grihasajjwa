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
  payment_mode: 'cash' | 'bank';
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
    paymentType: 'principal' as 'principal' | 'interest' | 'mixed',
    notes: '',
    payment_mode: 'cash' as 'cash' | 'bank',
  });

  // Fetch bills on mount
  useEffect(() => {
    if (user) fetchBills();
  }, [user, mahajan.id]);

  // Fetch transactions when bills update
  useEffect(() => {
    if (user && bills.length > 0) fetchTransactions();
  }, [user, bills]);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('mahajan_id', mahajan.id)
        .eq('user_id', user?.id)
        .order('bill_date', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch bills',
      });
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('bill_transactions')
        .select(`*, bill:bills(description, bill_amount)`)
        .in('bill_id', bills.map(b => b.id))
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch transactions',
      });
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

    let interest = 0;

    if (bill.interest_type === 'daily') {
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      interest = balance * rate * (daysDiff / 365);
    } else if (bill.interest_type === 'monthly') {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30;
      interest = balance * rate * (months + daysInMonth);
    }

    return Math.round(interest * 100) / 100; // round to 2 decimals
  };

  const calculateTotalOutstanding = () => {
    return bills.reduce((sum, bill) => {
      if (!bill.is_active) return sum;
      const balance = calculateBillBalance(bill.id);
      const interest = calculateInterest(bill, balance);
      return sum + balance + interest;
    }, 0);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBillId) return;

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bill_transactions')
        .insert({
          bill_id: selectedBillId,
          amount,
          transaction_type: paymentData.paymentType,
          payment_mode: paymentData.payment_mode,
          notes: paymentData.notes || null,
        });

      if (error) throw error;

      toast({
        title: 'Payment recorded',
        description: 'Payment has been successfully recorded',
      });

      setPaymentData({
        amount: '',
        paymentType: 'principal',
        notes: '',
        payment_mode: 'cash',
      });
      setShowPaymentDialog(false);
      setSelectedBillId('');

      fetchTransactions();
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
          <SearchBillbyRef bills={bills} />
        </TabsContent>

        <TabsContent value="searchTransaction">
          <SearchTransactionById transactions={transactions} />
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
              <Label>Select Bill</Label>
              <Select value={selectedBillId} onValueChange={setSelectedBillId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bill" />
                </SelectTrigger>
                <SelectContent>
                  {bills.filter(b => b.is_active).map((bill) => (
                    <SelectItem key={bill.id} value={bill.id}>
                      {bill.description || 'Bill'} - {formatCurrency(bill.bill_amount)}
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
                placeholder="Enter amount"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select 
                value={paymentData.paymentType} 
                onValueChange={(value: 'principal' | 'interest' | 'mixed') => 
                  setPaymentData({ ...paymentData, paymentType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
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
          fetchBills();
          if (onUpdate) onUpdate();
        }}
      />
    </div>
  );
};

export default MahajanDetails;
