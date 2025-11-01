import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar, IndianRupee, TrendingUp, Filter, Download } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

interface LoanTransaction {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  transaction_type: string;
  payment_mode: 'cash' | 'bank';
  notes: string | null;
  loan: {
    loan_number: string;
    description: string | null;
    customers: {
      name: string;
      phone: string | null;
    };
  };
}

interface DateWisePaymentsProps {
  onUpdate?: () => void;
}

const DateWisePayments: React.FC<DateWisePaymentsProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<LoanTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  useEffect(() => {
    const handleCustomerAdded = () => {
      fetchTransactions();
    };

    window.addEventListener('customer-added', handleCustomerAdded);
    return () => window.removeEventListener('customer-added', handleCustomerAdded);
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, startDate, endDate, selectedDate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans!inner(
            loan_number,
            description,
            customers!inner(name, phone),
            user_id
          )
        `)
        .eq('loan.user_id', user?.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      setTransactions((data || []) as any);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch payment transactions",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    if (selectedDate) {
      filtered = filtered.filter(transaction => 
        transaction.payment_date === selectedDate
      );
    } else {
      if (startDate) {
        filtered = filtered.filter(transaction => 
          transaction.payment_date >= startDate
        );
      }
      if (endDate) {
        filtered = filtered.filter(transaction => 
          transaction.payment_date <= endDate
        );
      }
    }

    setFilteredTransactions(filtered);
  };

  const groupTransactionsByDate = () => {
    const grouped: { [key: string]: LoanTransaction[] } = {};
    
    filteredTransactions.forEach(transaction => {
      const date = transaction.payment_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    // Sort dates in descending order (newest first)
    return Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => ({
        date,
        transactions: grouped[date]
      }));
  };

  const calculateTotalAmount = (transactions: LoanTransaction[]) => {
    return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  };

  const calculateTotalForPeriod = () => {
    return filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Customer', 'Phone', 'Loan Number', 'Amount', 'Type', 'Notes'],
      ...filteredTransactions.map(transaction => [
        format(parseISO(transaction.payment_date), 'dd/MM/yyyy'),
        transaction.loan.customers.name,
        transaction.loan.customers.phone || 'N/A',
        transaction.loan.loan_number,
        transaction.amount.toString(),
        transaction.transaction_type,
        transaction.notes || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_${startDate || 'all'}_${endDate || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedDate('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment records...</p>
        </div>
      </div>
    );
  }

  const groupedTransactions = groupTransactionsByDate();
  const totalForPeriod = calculateTotalForPeriod();

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Date-wise Payment Records</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedDate('');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedDate('');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specific-date">Specific Date</Label>
              <Input
                id="specific-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setStartDate('');
                  setEndDate('');
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Actions</Label>
              <Button onClick={clearFilters} variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalForPeriod)}
                </div>
                <div className="text-sm text-muted-foreground">Total Received</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {filteredTransactions.length}
                </div>
                <div className="text-sm text-muted-foreground">Payments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {groupedTransactions.length}
                </div>
                <div className="text-sm text-muted-foreground">Days</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date-wise Payment Cards */}
      <div className="space-y-4">
        {groupedTransactions.length > 0 ? (
          groupedTransactions.map(({ date, transactions }) => {
            const totalForDate = calculateTotalAmount(transactions);
            const formattedDate = format(parseISO(date), 'EEEE, MMMM dd, yyyy');
            
            return (
              <Card key={date}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <CardTitle className="text-lg">{formattedDate}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {transactions.length} payment{transactions.length !== 1 ? 's' : ''}
                      </Badge>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(totalForDate)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <IndianRupee className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">{transaction.loan.customers.name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{transaction.loan.loan_number}</span>
                              
                              <Badge variant="secondary" className="text-xs">
                                {transaction.transaction_type}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {transaction.payment_mode}
                              </Badge>
                            </div>
                            {transaction.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Note: {transaction.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {transaction.loan.customers.phone && (
                                <span>{transaction.loan.customers.phone}</span>
                              )}
                              </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.loan.description || 'Loan Payment'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No payments found</h3>
              <p className="text-muted-foreground">
                {selectedDate || startDate || endDate 
                  ? 'No payments found for the selected date range'
                  : 'No payment records available'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DateWisePayments;
