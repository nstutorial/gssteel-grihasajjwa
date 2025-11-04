import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PDFDownloader } from '@/lib/pdf-download';

interface Transaction {
  id: string;
  transaction_type: string;
  transaction_sub_type: string | null;
  amount: number;
  partner_id: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface CustomTransactionType {
  id: string;
  name: string;
}

interface FirmAccountStatementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

export function FirmAccountStatement({ 
  open, 
  onOpenChange, 
  accountId,
  accountName 
}: FirmAccountStatementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [typeSummary, setTypeSummary] = useState<Record<string, { count: number; total: number }>>({});
  const [customTypes, setCustomTypes] = useState<Record<string, string>>({});
  const itemsPerPage = 10;

  useEffect(() => {
    if (open && accountId) {
      fetchTransactions();
    }
  }, [open, accountId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch custom transaction types first
      const { data: customTypesData } = await supabase
        .from('custom_transaction_types')
        .select('id, name');
      
      const customTypesMap: Record<string, string> = {};
      (customTypesData || []).forEach(ct => {
        customTypesMap[ct.id] = ct.name;
      });
      setCustomTypes(customTypesMap);
      
      const { data, error } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('firm_account_id', accountId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      
      // Calculate type-wise summary (use sub-type if available)
      const summary: Record<string, { count: number; total: number }> = {};
      (data || []).forEach(txn => {
        const type = txn.transaction_sub_type || txn.transaction_type;
        const displayType = customTypesMap[type] || type;
        if (!summary[displayType]) {
          summary[displayType] = { count: 0, total: 0 };
        }
        summary[displayType].count += 1;
        summary[displayType].total += txn.amount;
      });
      setTypeSummary(summary);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      partner_deposit: 'Partner Deposit',
      partner_withdrawal: 'Partner Withdrawal',
      expense: 'Expense',
      income: 'Income',
      adjustment: 'Adjustment',
      gst_tax_payment: 'GST Tax Payment',
      income_tax_payment: 'Income Tax Payment',
      paid_to_ca: 'Paid To CA',
      paid_to_supplier: 'Paid To Supplier',
      refund: 'Refund'
    };
    
    // If it's a known type, return the label
    if (labels[type]) return labels[type];
    
    // Otherwise, format the snake_case to Title Case for custom types
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getDisplayType = (transaction: Transaction) => {
    const subType = transaction.transaction_sub_type;
    if (subType && customTypes[subType]) {
      return customTypes[subType];
    }
    const type = subType || transaction.transaction_type;
    return getTransactionTypeLabel(type);
  };

  // Filter transactions based on search query
  const filteredTransactions = transactions.filter(txn => {
    const query = searchQuery.toLowerCase();
    const typeLabel = getDisplayType(txn).toLowerCase();
    const description = (txn.description || '').toLowerCase();
    const amount = txn.amount.toString();
    const date = format(new Date(txn.transaction_date), 'dd MMM yyyy').toLowerCase();
    
    return typeLabel.includes(query) || 
           description.includes(query) || 
           amount.includes(query) ||
           date.includes(query);
  });
  
  // Calculate running balance
  const transactionsWithBalance = filteredTransactions.map((txn, index) => {
    let balance = 0;
    for (let i = filteredTransactions.length - 1; i >= index; i--) {
      const t = filteredTransactions[i];
      if (t.transaction_type === 'partner_withdrawal' || 
          t.transaction_type === 'expense' ||
          t.transaction_type === 'refund') {
        balance -= t.amount;
      } else {
        balance += t.amount;
      }
    }
    return { ...txn, balance };
  });

  // Pagination logic
  const totalPages = Math.ceil(transactionsWithBalance.length / itemsPerPage);
  const paginatedTransactions = transactionsWithBalance.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text('Account Statement', 14, 20);
      doc.setFontSize(12);
      doc.text(`Account: ${accountName}`, 14, 30);
      doc.text(`Date: ${format(new Date(), 'dd MMM yyyy')}`, 14, 37);
      
      // Transaction Type Summary
      doc.setFontSize(14);
      doc.text('Transaction Summary', 14, 47);
      doc.setFontSize(10);
      
      let summaryY = 53;
      Object.entries(typeSummary).forEach(([type, data]) => {
        doc.text(
          `${getTransactionTypeLabel(type)}: ${data.count} transactions, ₹${data.total.toFixed(2)}`,
          14,
          summaryY
        );
        summaryY += 6;
      });

      // Table data
      const tableData = transactionsWithBalance.map(txn => {
        return [
          format(new Date(txn.transaction_date), 'dd MMM yyyy'),
          getDisplayType(txn),
          txn.description || '-',
          `₹${txn.amount.toFixed(2)}`,
          `₹${txn.balance.toFixed(2)}`
        ];
      });

      (doc as any).autoTable({
        startY: summaryY + 5,
        head: [['Date', 'Type', 'Description', 'Amount', 'Balance']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 66, 66] }
      });

      const pdfBlob = doc.output('blob');
      await PDFDownloader.downloadPDF(
        pdfBlob,
        `${accountName}_statement_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      );
      
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Statement - {accountName}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="text-center py-8">Loading transactions...</div>
        ) : (
          <div className="space-y-6">
            {/* Transaction Type Summary Cards */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Transaction Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(typeSummary).map(([type, data]) => (
                  <Card key={type}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {getTransactionTypeLabel(type)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{data.total.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">{data.count} transactions</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Search and Export */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by type, description, amount, date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleExportPDF} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No transactions match your search' : 'No transactions found for this account'}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((transaction) => {
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.transaction_date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell>
                            {getDisplayType(transaction)}
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {transaction.description || '-'}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            transaction.transaction_type === 'partner_withdrawal' || 
                            transaction.transaction_type === 'expense' ||
                            transaction.transaction_type === 'refund'
                              ? 'text-destructive' 
                              : 'text-green-600'
                          }`}>
                            {transaction.transaction_type === 'partner_withdrawal' || 
                             transaction.transaction_type === 'expense' ||
                             transaction.transaction_type === 'refund'
                              ? '-' 
                              : '+'}
                            ₹{transaction.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{transaction.balance.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
