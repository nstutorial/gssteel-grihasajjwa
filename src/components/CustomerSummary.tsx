import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Download, Filter, RefreshCw } from 'lucide-react';

interface CustomerSummaryData {
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  total_loans: number;
  active_loans: number;
  total_loaned_amount: number;
  total_paid_amount: number;
  outstanding_balance: number;
  last_payment_date?: string;
  avg_payment_amount: number;
  payment_frequency: number;
}

const CustomerSummary: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [summaryData, setSummaryData] = useState<CustomerSummaryData[]>([]);
  const [cache, setCache] = useState<Map<string, CustomerSummaryData[]>>(new Map());

  useEffect(() => {
    if (user) {
      // Set default date range to current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      setDateFrom(firstDay.toISOString().split('T')[0]);
      setDateTo(lastDay.toISOString().split('T')[0]);
      
      fetchSummaryData(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0]);
    }
  }, [user]);

  const fetchSummaryData = async (fromDate?: string, toDate?: string, statusFilter?: 'all' | 'active' | 'closed') => {
    if (!user) return;

    const startDate = fromDate || dateFrom;
    const endDate = toDate || dateTo;
    const filter = statusFilter || loanStatusFilter;

    // Create cache key
    const cacheKey = `${startDate}-${endDate}-${filter}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      setSummaryData(cache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {

      // Single optimized query with joins and aggregation
      let query = supabase
        .from('customers')
        .select(`
          id,
          name,
          phone,
          loans!inner(
            id,
            principal_amount,
            is_active,
            loan_transactions(
              id,
              amount,
              payment_date
            )
          )
        `)
        .eq('user_id', user.id);

      // Apply loan status filter
      if (filter === 'active') {
        query = query.eq('loans.is_active', true);
      } else if (filter === 'closed') {
        query = query.eq('loans.is_active', false);
      }

      const { data: customersData, error } = await query;

      if (error) throw error;

      // Process data efficiently
      const summaryData: CustomerSummaryData[] = (customersData || [])
        .map(customer => {
          const customerLoans = customer.loans || [];
          
          // Filter transactions by date range
          const transactionsInRange = customerLoans.flatMap(loan => 
            (loan.loan_transactions || []).filter(transaction => {
              const paymentDate = new Date(transaction.payment_date);
              return paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate);
            })
          );

          // Calculate totals
          const totalLoans = customerLoans.length;
          const activeLoans = customerLoans.filter(loan => loan.is_active).length;
          const totalLoanedAmount = customerLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
          
          const totalPaidAmount = transactionsInRange.reduce((sum, transaction) => sum + transaction.amount, 0);
          const paymentFrequency = transactionsInRange.length;
          
          // Calculate outstanding balance (all payments, not just date range)
          const allTransactions = customerLoans.flatMap(loan => loan.loan_transactions || []);
          const totalPaidAllTime = allTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
          const outstandingBalance = Math.max(0, totalLoanedAmount - totalPaidAllTime);
          
          // Find last payment date
          const lastPaymentDate = transactionsInRange.length > 0 
            ? transactionsInRange.reduce((latest, transaction) => 
                new Date(transaction.payment_date) > new Date(latest.payment_date) ? transaction : latest
              ).payment_date
            : undefined;

          const avgPaymentAmount = paymentFrequency > 0 ? totalPaidAmount / paymentFrequency : 0;

          // Only include customers with loans matching the filter
          if (totalLoans === 0) return null;

          return {
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone || undefined,
            total_loans: totalLoans,
            active_loans: activeLoans,
            total_loaned_amount: totalLoanedAmount,
            total_paid_amount: totalPaidAmount,
            outstanding_balance: outstandingBalance,
            last_payment_date: lastPaymentDate,
            avg_payment_amount: avgPaymentAmount,
            payment_frequency: paymentFrequency,
          };
        })
        .filter(Boolean) as CustomerSummaryData[];

      // Sort the filtered data
      summaryData.sort((a, b) => b.outstanding_balance - a.outstanding_balance);

      // Cache the results
      setCache(prevCache => {
        const newCache = new Map(prevCache);
        newCache.set(cacheKey, summaryData);
        // Limit cache size to 10 entries
        if (newCache.size > 10) {
          const firstKey = newCache.keys().next().value;
          newCache.delete(firstKey);
        }
        return newCache;
      });

      setSummaryData(summaryData);
    } catch (error) {
      console.error('Error fetching summary data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customer summary data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchSummaryData(dateFrom, dateTo, loanStatusFilter);
  };

  const handleRefresh = () => {
    // Clear cache to force fresh data
    setCache(new Map());
    fetchSummaryData(dateFrom, dateTo, loanStatusFilter);
  };

  const handleStatusFilterChange = (value: 'all' | 'active' | 'closed') => {
    setLoanStatusFilter(value);
    fetchSummaryData(dateFrom, dateTo, value);
  };

  const exportToCSV = () => {
    const csvContent = [
      // Headers
      [
        'Customer Name',
        'Phone',
        'Total Loans',
        'Active Loans',
        'Total Loaned',
        'Total Paid',
        'Outstanding Balance',
        'Last Payment',
        'Avg Payment',
        'Payment Count'
      ].join(','),
      // Data rows
      ...summaryData.map(summary => [
        summary.customer_name,
        summary.customer_phone || '',
        summary.total_loans,
        summary.active_loans,
        summary.total_loaned_amount.toFixed(2),
        summary.total_paid_amount.toFixed(2),
        summary.outstanding_balance.toFixed(2),
        summary.last_payment_date ? new Date(summary.last_payment_date).toLocaleDateString() : '',
        summary.avg_payment_amount.toFixed(2),
        summary.payment_frequency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-summary-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Customer summary data exported to CSV',
    });
  };

  const totalLoaned = summaryData.reduce((sum, item) => sum + item.total_loaned_amount, 0);
  const totalPaid = summaryData.reduce((sum, item) => sum + item.total_paid_amount, 0);
  const totalOutstanding = summaryData.reduce((sum, item) => sum + item.outstanding_balance, 0);
  const activeLoanCount = summaryData.reduce((sum, item) => sum + item.active_loans, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Customer Summary</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading customer summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Customer Summary</h3>
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Loan Status</label>
                <Select value={loanStatusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Loans</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="closed">Closed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleFilter} className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {loanStatusFilter === 'all' ? 'all' : loanStatusFilter} loans with payment activity from {new Date(dateFrom).toLocaleDateString()} to {new Date(dateTo).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Loaned</div>
            <div className="text-2xl font-bold text-blue-600">₹{totalLoaned.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Received</div>
            <div className="text-2xl font-bold text-green-600">₹{totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="text-2xl font-bold text-orange-600">₹{totalOutstanding.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Active Loans</div>
            <div className="text-2xl font-bold text-purple-600">{activeLoanCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer-wise Loans & Payments Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No customer activity found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Loans</TableHead>
                    <TableHead className="text-right">Active Loans</TableHead>
                    <TableHead className="text-right">Total Loaned</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead className="text-right">Avg Payment</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((customer) => (
                    <TableRow key={customer.customer_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.customer_name}</div>
                          {customer.customer_phone && (
                            <div className="text-sm text-muted-foreground">{customer.customer_phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{customer.total_loans}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={customer.active_loans > 0 ? "default" : "secondary"}>
                          {customer.active_loans}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        ₹{customer.total_loaned_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ₹{customer.total_paid_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-orange-600">
                        ₹{customer.outstanding_balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {customer.last_payment_date ? (
                          <span className="text-sm">
                            {new Date(customer.last_payment_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No payments</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={customer.avg_payment_amount > 0 ? "text-sm" : "text-sm text-muted-foreground"}>
                          ₹{customer.avg_payment_amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{customer.payment_frequency}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerSummary;
