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
import { ArrowLeft, Plus, IndianRupee, FileText } from 'lucide-react';
import CustomerStatement from './CustomerStatement';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
}

interface Loan {
  id: string;
  principal_amount: number;
  processing_fee?: number;
  total_outstanding?: number;
  interest_rate: number | null;
  interest_type: string | null;
  loan_date: string;
  due_date: string | null;
  description: string | null;
  is_active: boolean | null;
}

interface LoanTransaction {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  transaction_type: string;
  payment_mode: 'cash' | 'bank';
  notes: string | null;
  loan: {
    description: string | null;
    principal_amount: number;
  };
}

interface CustomerDetailsProps {
  customer: Customer;
  onBack: () => void;
}

const CustomerDetails: React.FC<CustomerDetailsProps> = ({ customer, onBack }) => {
  const { user } = useAuth();
  const { settings: controlSettings } = useControl();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentType: 'principal' as 'principal' | 'interest' | 'mixed',
    notes: '',
    payment_mode: 'cash' as 'cash' | 'bank',
  });

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user, customer.id]);

  useEffect(() => {
    if (user && loans.length > 0) {
      fetchTransactions();
    }
  }, [user, loans]);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('user_id', user?.id)
        .order('loan_date', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    }
  };

  const fetchTransactions = async () => {
    if (loans.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans(description, principal_amount)
        `)
        .in('loan_id', loans.map(loan => loan.id))
        .order('payment_date', { ascending: true });

      if (error) throw error;
      setTransactions((data || []) as any);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLoanId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: selectedLoanId,
          amount: parseFloat(paymentData.amount),
          transaction_type: paymentData.paymentType,
          payment_mode: paymentData.payment_mode,
          notes: paymentData.notes || null,
        });

      if (error) throw error;

      toast({
        title: "Payment recorded",
        description: "The payment has been successfully recorded.",
      });

      // Dispatch event to refresh daywise payment schedule
      window.dispatchEvent(new CustomEvent('payment-recorded'));

      setPaymentData({
        amount: '',
        paymentType: 'principal',
        notes: '',
        payment_mode: 'cash',
      });
      
      setShowPaymentDialog(false);
      setSelectedLoanId('');
      fetchTransactions();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record payment. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateLoanBalance = (loan: Loan) => {
    const loanTransactions = transactions.filter(t => t.loan_id === loan.id);
    const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
    const initialOutstanding = loan.total_outstanding || loan.principal_amount;
    return initialOutstanding - totalPaid;
  };

  const calculateInterest = (loan: Loan, balance: number) => {
    if (!loan.interest_rate || loan.interest_type === 'none') return 0;
    
    const rate = loan.interest_rate / 100;
    const startDate = new Date(loan.loan_date);
    const endDate = new Date();
    
    if (loan.interest_type === 'daily') {
      // Daily interest calculation
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      // Monthly interest calculation
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30; // Approximate partial month
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateOutstandingAmount = (loan: Loan) => {
    const balance = calculateLoanBalance(loan);
    const interest = calculateInterest(loan, balance);
    return balance + interest;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{customer.name}</h2>
          {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
          {customer.address && <p className="text-muted-foreground">{customer.address}</p>}
          {customer.payment_day && (
            <p className="text-muted-foreground">
              Payment Day: {customer.payment_day.charAt(0).toUpperCase() + customer.payment_day.slice(1)}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="statement" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Statement
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Loans</CardTitle>
            {controlSettings.allowRecordPayment && (
              <Button 
                size="sm" 
                onClick={() => setShowPaymentDialog(true)}
                disabled={loans.filter(l => l.is_active).length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loans.filter(l => l.is_active).map((loan) => {
              const balance = calculateLoanBalance(loan);
              return (
                <div key={loan.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{loan.description || 'Loan'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(loan.loan_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">
                        {formatCurrency(loan.principal_amount)}
                      </Badge>
                      {loan.processing_fee && loan.processing_fee > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Processing Fee: {formatCurrency(loan.processing_fee)}
                        </p>
                      )}
                      {loan.total_outstanding && (
                        <p className="text-sm font-semibold text-orange-600 mt-1">
                          Total Outstanding: {formatCurrency(loan.total_outstanding)}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Balance: {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                  {loan.interest_type !== 'none' && (
                    <p className="text-sm text-muted-foreground">
                      {loan.interest_rate}% {loan.interest_type} interest
                    </p>
                  )}
                </div>
              );
            })}
            {loans.filter(l => l.is_active).length === 0 && (
              <p className="text-muted-foreground text-center py-4">No active loans</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{transaction.loan?.description || 'Loan Payment'}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(transaction.payment_date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{transaction.transaction_type}</span>
                      <Badge variant="outline" className="text-xs">
                        {transaction.payment_mode}
                      </Badge>
                    </div>
                    {transaction.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{transaction.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">
                      +{formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No transactions found</p>
              )}
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="statement" className="space-y-6">
          <CustomerStatement customer={customer} />
        </TabsContent>
      </Tabs>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Loan</Label>
              <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a loan" />
                </SelectTrigger>
                <SelectContent>
                  {loans.filter(l => l.is_active && calculateLoanBalance(l) > 0).map((loan) => {
                    const outstanding = calculateOutstandingAmount(loan);
                    return (
                      <SelectItem key={loan.id} value={loan.id}>
                        {loan.description || 'Loan'} - {formatCurrency(loan.principal_amount)} (Outstanding: {formatCurrency(outstanding)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="Enter payment amount"
                value={paymentData.amount}
                onChange={(e) => {
                  const value = e.target.value;
                  const selectedLoan = loans.find(l => l.id === selectedLoanId);
                  if (selectedLoan) {
                    const maxAmount = calculateOutstandingAmount(selectedLoan);
                    if (parseFloat(value) > maxAmount) {
                      toast({
                        variant: "destructive",
                        title: "Invalid amount",
                        description: `Payment amount cannot exceed outstanding balance of ${formatCurrency(maxAmount)}`,
                      });
                      return;
                    }
                  }
                  setPaymentData({ ...paymentData, amount: value });
                }}
                required
                max={selectedLoanId ? calculateOutstandingAmount(loans.find(l => l.id === selectedLoanId)!) : undefined}
              />
              {selectedLoanId && (
                <p className="text-xs text-muted-foreground">
                  Maximum amount: {formatCurrency(calculateOutstandingAmount(loans.find(l => l.id === selectedLoanId)!))}
                </p>
              )}
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
                  <SelectItem value="principal">Principal Payment</SelectItem>
                  <SelectItem value="interest">Interest Payment</SelectItem>
                  <SelectItem value="mixed">Mixed Payment</SelectItem>
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
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                type="text"
                placeholder="Enter payment notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </div>

            {controlSettings.allowRecordPayment && (
              <Button type="submit" className="w-full" disabled={loading || !selectedLoanId}>
                {loading ? 'Recording...' : 'Record Payment'}
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDetails;
