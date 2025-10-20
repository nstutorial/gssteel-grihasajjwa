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

interface MahajanSummaryData {
  mahajan_id: string;
  mahajan_name: string;
  mahajan_phone?: string;
  total_bills: number;
  active_bills: number;
  total_bill_amount: number;
  total_paid_amount: number;
  outstanding_balance: number;
  last_payment_date?: string;
  avg_payment_amount: number;
  payment_frequency: number;
}

const MahajanSummary: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [summaryData, setSummaryData] = useState<MahajanSummaryData[]>([]);
  const [cache, setCache] = useState<Map<string, MahajanSummaryData[]>>(new Map());

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
    const filter = statusFilter || billStatusFilter;

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
        .from('mahajans')
        .select(`
          id,
          name,
          phone,
          bills!inner(
            id,
            bill_amount,
            is_active,
            bill_transactions(
              id,
              amount,
              payment_date
            )
          )
        `)
        .eq('user_id', user.id);

      // Apply bill status filter
      if (filter === 'active') {
        query = query.eq('bills.is_active', true);
      } else if (filter === 'closed') {
        query = query.eq('bills.is_active', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process the data
      const processedData: MahajanSummaryData[] = (data || []).map((mahajan: any) => {
        const bills = mahajan.bills || [];
        
        const totalBills = bills.length;
        const activeBills = bills.filter((bill: any) => bill.is_active).length;
        
        const totalBillAmount = bills.reduce((sum: number, bill: any) => sum + Number(bill.bill_amount), 0);
        
        const allTransactions = bills.flatMap((bill: any) => bill.bill_transactions || []);
        const totalPaidAmount = allTransactions.reduce((sum: number, trans: any) => sum + Number(trans.amount), 0);
        
        const outstandingBalance = totalBillAmount - totalPaidAmount;
        
        const lastPaymentDate = allTransactions.length > 0 
          ? allTransactions.sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0].payment_date
          : undefined;
        
        const avgPaymentAmount = allTransactions.length > 0 ? totalPaidAmount / allTransactions.length : 0;
        
        const paymentFrequency = allTransactions.length;

        return {
          mahajan_id: mahajan.id,
          mahajan_name: mahajan.name,
          mahajan_phone: mahajan.phone,
          total_bills: totalBills,
          active_bills: activeBills,
          total_bill_amount: totalBillAmount,
          total_paid_amount: totalPaidAmount,
          outstanding_balance: outstandingBalance,
          last_payment_date: lastPaymentDate,
          avg_payment_amount: avgPaymentAmount,
          payment_frequency: paymentFrequency,
        };
      });

      // Filter by date range if specified
      let filteredData = processedData;
      if (startDate && endDate) {
        filteredData = processedData.filter(mahajan => {
          if (mahajan.last_payment_date) {
            const paymentDate = new Date(mahajan.last_payment_date);
            const fromDate = new Date(startDate);
            const toDate = new Date(endDate);
            return paymentDate >= fromDate && paymentDate <= toDate;
          }
          return false;
        });
      }

      // Cache the result
      setCache(prev => new Map(prev).set(cacheKey, filteredData));
      setSummaryData(filteredData);
    } catch (error) {
      console.error('Error fetching mahajan summary:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch mahajan summary data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    fetchSummaryData();
  };

  const handleRefresh = () => {
    // Clear cache and refetch
    setCache(new Map());
    fetchSummaryData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const exportToCSV = () => {
    const headers = [
      'Mahajan Name',
      'Phone',
      'Total Bills',
      'Active Bills',
      'Total Bill Amount',
      'Total Paid Amount',
      'Outstanding Balance',
      'Last Payment Date',
      'Avg Payment Amount',
      'Payment Frequency'
    ];

    const csvData = summaryData.map(mahajan => [
      mahajan.mahajan_name,
      mahajan.mahajan_phone || '',
      mahajan.total_bills,
      mahajan.active_bills,
      mahajan.total_bill_amount,
      mahajan.total_paid_amount,
      mahajan.outstanding_balance,
      mahajan.last_payment_date ? formatDate(mahajan.last_payment_date) : '',
      mahajan.avg_payment_amount,
      mahajan.payment_frequency
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahajan-summary-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'CSV Downloaded',
      description: 'Mahajan summary has been downloaded as CSV.',
    });
  };

  const totalStats = summaryData.reduce((acc, mahajan) => ({
    totalBills: acc.totalBills + mahajan.total_bills,
    activeBills: acc.activeBills + mahajan.active_bills,
    totalBillAmount: acc.totalBillAmount + mahajan.total_bill_amount,
    totalPaidAmount: acc.totalPaidAmount + mahajan.total_paid_amount,
    outstandingBalance: acc.outstandingBalance + mahajan.outstanding_balance,
  }), {
    totalBills: 0,
    activeBills: 0,
    totalBillAmount: 0,
    totalPaidAmount: 0,
    outstandingBalance: 0,
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Mahajan Summary Report
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={loading || summaryData.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bill Status</label>
              <Select value={billStatusFilter} onValueChange={(value: 'all' | 'active' | 'closed') => {
                setBillStatusFilter(value);
                fetchSummaryData(undefined, undefined, value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bills</SelectItem>
                  <SelectItem value="active">Active Bills</SelectItem>
                  <SelectItem value="closed">Closed Bills</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleFilterChange} className="w-full" disabled={loading}>
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Mahajans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalBills}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bill Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalStats.totalBillAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalStats.totalPaidAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalStats.outstandingBalance)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mahajan Details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading mahajan summary...</div>
          ) : summaryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mahajan data found for the selected criteria
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mahajan</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Total Bills</TableHead>
                    <TableHead className="text-center">Active Bills</TableHead>
                    <TableHead className="text-right">Bill Amount</TableHead>
                    <TableHead className="text-right">Paid Amount</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-center">Last Payment</TableHead>
                    <TableHead className="text-center">Avg Payment</TableHead>
                    <TableHead className="text-center">Payments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((mahajan) => (
                    <TableRow key={mahajan.mahajan_id}>
                      <TableCell className="font-medium">{mahajan.mahajan_name}</TableCell>
                      <TableCell>{mahajan.mahajan_phone || '-'}</TableCell>
                      <TableCell className="text-center">{mahajan.total_bills}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={mahajan.active_bills > 0 ? 'default' : 'secondary'}>
                          {mahajan.active_bills}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(mahajan.total_bill_amount)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(mahajan.total_paid_amount)}</TableCell>
                      <TableCell className="text-right">
                        <span className={mahajan.outstanding_balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {formatCurrency(mahajan.outstanding_balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {mahajan.last_payment_date ? formatDate(mahajan.last_payment_date) : '-'}
                      </TableCell>
                      <TableCell className="text-center">{formatCurrency(mahajan.avg_payment_amount)}</TableCell>
                      <TableCell className="text-center">{mahajan.payment_frequency}</TableCell>
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

export default MahajanSummary;
