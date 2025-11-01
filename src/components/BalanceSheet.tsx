import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download,
  Filter,
  Calculator 
} from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: 'earning' | 'expense';
  payment_method: 'cash' | 'bank';
  category: {
    name: string;
  } | null;
}

interface CategorySummary {
  category: string;
  amount: number;
  transactionCount: number;
}

interface BalanceSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  cashIncome: number;
  cashExpense: number;
  bankIncome: number;
  bankExpense: number;
  netCash: number;
  netBank: number;
}

const BalanceSheet: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Use EXACT same query logic as Expenses and Earnings tabs
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          category:expense_categories(name)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        console.log('Fetched transactions:', data);
        setTransactions((data || []) as Transaction[]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'today':
        startDate = endDate = new Date();
        break;
      case 'thisWeek':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startDate = startOfWeek;
        endDate = new Date(startOfWeek);
        endDate.setDate(startOfWeek.getDate() + 6);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all':
        setDateFrom('');
        setDateTo('');
        setSelectedPeriod('all');
        return;
      case 'custom':
        return; // Let user set custom dates
      default:
        return;
    }

    setDateFrom(startDate.toISOString().split('T')[0]);
    setDateTo(endDate.toISOString().split('T')[0]);
    setSelectedPeriod(period);
  };

  // Use EXACT same filtering logic as Expenses and Earnings tabs
  const filteredTransactions = transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    const matchesDateFrom = !dateFrom || transactionDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || transactionDate <= new Date(dateTo);

    return matchesDateFrom && matchesDateTo;
  });

  const calculateBalanceSummary = (): BalanceSummary => {
    const income = filteredTransactions.filter(t => t.type === 'earning');
    const expense = filteredTransactions.filter(t => t.type === 'expense');

    console.log('Calculating balance summary with filtered transactions:', filteredTransactions);
    console.log('Income transactions:', income);
    console.log('Expense transactions:', expense);

    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0);
    
    const cashIncome = income.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
    const cashExpense = expense.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0);
    
    const bankIncome = income.filter(t => t.payment_method === 'bank').reduce((sum, t) => sum + t.amount, 0);
    const bankExpense = expense.filter(t => t.payment_method === 'bank').reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      cashIncome,
      cashExpense,
      bankIncome,
      bankExpense,
      netCash: cashIncome - cashExpense,
      netBank: bankIncome - bankExpense,
    };
  };

  const calculateEarningCategorySummary = (): CategorySummary[] => {
    const categoryMap = new Map<string, CategorySummary>();
    const earnings = filteredTransactions.filter(t => t.type === 'earning');

    earnings.forEach(transaction => {
      const categoryName = transaction.category?.name || 'Uncategorized';
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          amount: 0,
          transactionCount: 0,
        });
      }

      const category = categoryMap.get(categoryName)!;
      category.amount += transaction.amount;
      category.transactionCount += 1;
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  };

  const calculateExpenseCategorySummary = (): CategorySummary[] => {
    const categoryMap = new Map<string, CategorySummary>();
    const expenses = filteredTransactions.filter(t => t.type === 'expense');

    expenses.forEach(transaction => {
      const categoryName = transaction.category?.name || 'Uncategorized';
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          amount: 0,
          transactionCount: 0,
        });
      }

      const category = categoryMap.get(categoryName)!;
      category.amount += transaction.amount;
      category.transactionCount += 1;
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  };

  const exportToCSV = () => {
    const balanceSummary = calculateBalanceSummary();
    const earningCategorySummary = calculateEarningCategorySummary();
    const expenseCategorySummary = calculateExpenseCategorySummary();
    
    // Create separate CSV files for each sheet
    const exportSheet = (data: string[][], filename: string) => {
      const csvContent = data.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Balance Sheet Summary
    const balanceSheetData = [
      ['Balance Sheet Summary', '', ''],
      ['Period:', `${dateFrom || 'All time'} - ${dateTo || 'All time'}`, ''],
      ['', '', ''],
      ['Income', 'Expense', 'Net Balance'],
      [balanceSummary.totalIncome.toFixed(2), balanceSummary.totalExpense.toFixed(2), balanceSummary.netBalance.toFixed(2)],
      ['', '', ''],
      ['Cash Transactions', '', ''],
      ['Cash Income', 'Cash Expense', 'Net Cash'],
      [balanceSummary.cashIncome.toFixed(2), balanceSummary.cashExpense.toFixed(2), balanceSummary.netCash.toFixed(2)],
      ['', '', ''],
      ['Bank Transactions', '', ''],
      ['Bank Income', 'Bank Expense', 'Net Bank'],
      [balanceSummary.bankIncome.toFixed(2), balanceSummary.bankExpense.toFixed(2), balanceSummary.netBank.toFixed(2)],
      ['', '', ''],
      ['Earning Categories', '', '', ''],
      ['Category', 'Amount', 'Count', ''],
      ...earningCategorySummary.map(cat => [cat.category, cat.amount.toFixed(2), cat.transactionCount.toString(), '']),
      ['', '', '', ''],
      ['Expense Categories', '', '', ''],
      ['Category', 'Amount', 'Count', ''],
      ...expenseCategorySummary.map(cat => [cat.category, cat.amount.toFixed(2), cat.transactionCount.toString(), ''])
    ];

    // Earnings Transactions Details
    const earningsData = [
      ['Earnings Transactions Details', '', '', '', '', ''],
      ['Period:', `${dateFrom || 'All time'} - ${dateTo || 'All time'}`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Date', 'Description', 'Category', 'Payment Method', 'Amount', ''],
      ...earningTransactions.map(transaction => [
        format(new Date(transaction.date), 'dd MMM yyyy'),
        transaction.description,
        transaction.category?.name || 'Uncategorized',
        transaction.payment_method,
        transaction.amount.toFixed(2),
        ''
      ])
    ];

    // Expenses Transactions Details
    const expensesData = [
      ['Expenses Transactions Details', '', '', '', '', ''],
      ['Period:', `${dateFrom || 'All time'} - ${dateTo || 'All time'}`, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Date', 'Description', 'Category', 'Payment Method', 'Amount', ''],
      ...expenseTransactions.map(transaction => [
        format(new Date(transaction.date), 'dd MMM yyyy'),
        transaction.description,
        transaction.category?.name || 'Uncategorized',
        transaction.payment_method,
        transaction.amount.toFixed(2),
        ''
      ])
    ];

    // Export all three CSV files
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
    exportSheet(balanceSheetData, `balance-sheet-summary-${timestamp}.csv`);
    
    if (earningTransactions.length > 0) {
      exportSheet(earningsData, `earnings-transactions-${timestamp}.csv`);
    }
    
    if (expenseTransactions.length > 0) {
      exportSheet(expensesData, `expenses-transactions-${timestamp}.csv`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading balance sheet...</div>;
  }

  const balanceSummary = calculateBalanceSummary();
  const earningCategorySummary = calculateEarningCategorySummary();
  const expenseCategorySummary = calculateExpenseCategorySummary();
  const earningTransactions = filteredTransactions.filter(t => t.type === 'earning');
  const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense');

  return (
    <div className="space-y-6">

      {/* Header with Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Balance Sheet</h2>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Label className="font-medium">Quick Filters:</Label>
          </div>
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{balanceSummary.totalIncome.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{balanceSummary.totalExpense.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <Calculator className={`h-4 w-4 ${balanceSummary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balanceSummary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{balanceSummary.netBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filteredTransactions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Section with Tabs */}
      {earningTransactions.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-700">Earnings Analysis</CardTitle>
              <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
                ₹{balanceSummary.totalIncome.toFixed(2)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Category Summary</TabsTrigger>
                <TabsTrigger value="transactions">Transaction Details</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {/* Earning Category Summary Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {earningCategorySummary.map((category) => (
                        <TableRow key={category.category}>
                          <TableCell className="font-medium">{category.category}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            ₹{category.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                {/* Earning Transactions Details */}
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {earningTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="text-sm">
                            {format(new Date(transaction.date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">{transaction.description}</TableCell>
                          <TableCell>
                            <span className="text-sm">{transaction.category?.name || 'Uncategorized'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {transaction.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            ₹{transaction.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Expenses Section with Tabs */}
      {expenseTransactions.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <CardTitle className="text-lg text-red-700">Expenses Analysis</CardTitle>
              <Badge variant="outline" className="ml-auto text-red-600 border-red-600">
                ₹{balanceSummary.totalExpense.toFixed(2)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Category Summary</TabsTrigger>
                <TabsTrigger value="transactions">Transaction Details</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {/* Expense Category Summary Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseCategorySummary.map((category) => (
                        <TableRow key={category.category}>
                          <TableCell className="font-medium">{category.category}</TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            ₹{category.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                {/* Expense Transactions Details */}
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="text-sm">
                            {format(new Date(transaction.date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">{transaction.description}</TableCell>
                          <TableCell>
                            <span className="text-sm">{transaction.category?.name || 'Uncategorized'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {transaction.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            ₹{transaction.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Payment Method Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Cash Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cash Earnings:</span>
                <span className="font-medium text-green-600">₹{balanceSummary.cashIncome.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Cash Expenses:</span>
                <span className="font-medium text-red-600">₹{balanceSummary.cashExpense.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Net Cash:</span>
                <span className={`${balanceSummary.netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{balanceSummary.netCash.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-blue-700">Bank Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Bank Earnings:</span>
                <span className="font-medium text-green-600">₹{balanceSummary.bankIncome.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Bank Expenses:</span>
                <span className="font-medium text-red-600">₹{balanceSummary.bankExpense.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Net Bank:</span>
                <span className={`${balanceSummary.netBank >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{balanceSummary.netBank.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BalanceSheet;
