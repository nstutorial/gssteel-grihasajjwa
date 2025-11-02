import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Trash2, Send, Download, FileSpreadsheet, Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useControl } from '@/contexts/ControlContext';
import { EditFirmTransactionDialog } from '@/components/EditFirmTransactionDialog';
import { SendMoneyDialog } from '@/components/SendMoneyDialog';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDownloader } from '@/lib/pdf-download';
import * as XLSX from 'xlsx';

interface FirmAccount {
  id: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  current_balance: number;
  account_number: string | null;
  bank_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  transaction_sub_type: string | null;
  amount: number;
  partner_id: string | null;
  mahajan_id: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export default function FirmAccountDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useControl();
  const [account, setAccount] = useState<FirmAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sendMoneyDialogOpen, setSendMoneyDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeSummary, setTypeSummary] = useState<Record<string, { count: number; total: number }>>({});
  const [customTypes, setCustomTypes] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<Record<string, string>>({});
  const [mahajans, setMahajans] = useState<Record<string, string>>({});
  const itemsPerPage = 20;

  useEffect(() => {
    if (id) {
      fetchAccountDetails();
      fetchTransactions();
      fetchCustomTypes();
      fetchPartners();
      fetchMahajans();
    }
  }, [id]);

  // Realtime subscription for firm_transactions
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('firm-transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'firm_transactions',
          filter: `firm_account_id=eq.${id}`
        },
        () => {
          fetchTransactions();
          fetchAccountDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchAccountDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Calculate current balance from transaction history
      const { data: txns, error: txnError } = await supabase
        .from('firm_transactions')
        .select('amount, transaction_type')
        .eq('firm_account_id', id);

      if (txnError) throw txnError;

      const calculatedBalance = (txns || []).reduce((balance, txn) => {
        if (txn.transaction_type === 'partner_deposit' || txn.transaction_type === 'income') {
          return balance + txn.amount;
        } else if (txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund') {
          return balance - txn.amount;
        }
        return balance;
      }, data.opening_balance);

      setAccount({ ...data, current_balance: calculatedBalance });
    } catch (error: any) {
      console.error('Error fetching account:', error);
      toast.error('Failed to load account details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('firm_account_id', id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      
      // Calculate summary by type
      const summary: Record<string, { count: number; total: number }> = {};
      (data || []).forEach(txn => {
        if (!summary[txn.transaction_type]) {
          summary[txn.transaction_type] = { count: 0, total: 0 };
        }
        summary[txn.transaction_type].count++;
        summary[txn.transaction_type].total += txn.amount;
      });
      setTypeSummary(summary);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    }
  };

  const fetchCustomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_transaction_types')
        .select('*');

      if (error) throw error;
      
      const typesMap: Record<string, string> = {};
      (data || []).forEach(type => {
        // Store with the exact name as key
        typesMap[type.name] = type.name;
        // Also store snake_case version
        const snakeCase = type.name.toLowerCase().replace(/\s+/g, '_');
        typesMap[snakeCase] = type.name;
      });
      setCustomTypes(typesMap);
    } catch (error: any) {
      console.error('Error fetching custom types:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name');

      if (error) throw error;
      
      const partnersMap: Record<string, string> = {};
      (data || []).forEach(partner => {
        partnersMap[partner.id] = partner.name;
      });
      setPartners(partnersMap);
    } catch (error: any) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchMahajans = async () => {
    try {
      const { data, error } = await supabase
        .from('mahajans')
        .select('id, name');

      if (error) throw error;
      
      const mahajansMap: Record<string, string> = {};
      (data || []).forEach(mahajan => {
        mahajansMap[mahajan.id] = mahajan.name;
      });
      setMahajans(mahajansMap);
    } catch (error: any) {
      console.error('Error fetching mahajans:', error);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    if (!settings.allowEdit) {
      toast.error('Edit permission denied');
      return;
    }
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!settings.allowDelete) {
      toast.error('Delete permission denied');
      return;
    }

    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('firm_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
      toast.success('Transaction deleted');
      fetchTransactions();
      fetchAccountDetails();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  const handleTransactionUpdated = () => {
    fetchTransactions();
    fetchAccountDetails();
  };

  const getTransactionTypeLabel = (type: string) => {
    // First check predefined types
    const labels: Record<string, string> = {
      partner_deposit: 'Partner Deposit',
      partner_withdrawal: 'Partner Withdrawal',
      refund: 'Refund',
      expense: 'Expense',
      income: 'Income',
      adjustment: 'Adjustment',
      gst_tax_payment: 'GST Tax Payment',
      income_tax_payment: 'Income Tax Payment',
      paid_to_ca: 'Paid To CA',
      paid_to_supplier: 'Paid To Supplier'
    };
    
    if (labels[type]) return labels[type];
    
    // Check if it's a custom type (exact match or snake_case match)
    if (customTypes[type]) return customTypes[type];
    
    // Format snake_case to Title Case as fallback
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getSubTransactionTypeLabel = (subType: string | null) => {
    if (!subType) return '-';
    
    // Check if it's a custom type ID
    if (subType.startsWith('custom_')) {
      const customTypeId = subType.replace('custom_', '');
      const customType = Object.values(customTypes).find((_, idx) => 
        Object.keys(customTypes)[idx] === customTypeId
      );
      if (customType) return customType;
    }
    
    // Use the standard labels
    return getTransactionTypeLabel(subType);
  };

  const getTransactionDescription = (txn: Transaction) => {
    const parts: string[] = [];
    
    // Add partner information if available
    if (txn.partner_id && partners[txn.partner_id]) {
      parts.push(`Partner: ${partners[txn.partner_id]}`);
    }
    
    // Add mahajan information if available
    if (txn.mahajan_id && mahajans[txn.mahajan_id]) {
      parts.push(`Mahajan: ${mahajans[txn.mahajan_id]}`);
    }
    
    // Add the transaction description/notes
    if (txn.description) {
      parts.push(`Notes: ${txn.description}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  // Filter transactions based on search and date
  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch = searchQuery === '' || 
      getTransactionTypeLabel(txn.transaction_type).toLowerCase().includes(searchQuery.toLowerCase()) ||
      getSubTransactionTypeLabel(txn.transaction_sub_type).toLowerCase().includes(searchQuery.toLowerCase()) ||
      getTransactionDescription(txn).toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.amount.toString().includes(searchQuery) ||
      format(new Date(txn.transaction_date), 'dd MMM yyyy').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDateRange = 
      (!startDate || new Date(txn.transaction_date) >= new Date(startDate)) &&
      (!endDate || new Date(txn.transaction_date) <= new Date(endDate));
    
    return matchesSearch && matchesDateRange;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate page totals
  const pageCredits = paginatedTransactions.reduce((sum, txn) => {
    if (txn.transaction_type === 'partner_deposit' || txn.transaction_type === 'income') {
      return sum + txn.amount;
    }
    return sum;
  }, 0);

  const pageDebits = paginatedTransactions.reduce((sum, txn) => {
    if (txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund') {
      return sum + txn.amount;
    }
    return sum;
  }, 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  const handleExportPDF = async () => {
    if (!account) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text('Firm Account Statement', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Account: ${account.account_name}`, 14, 25);
    doc.text(`Type: ${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)}`, 14, 32);
    doc.text(`Current Balance: ₹${account.current_balance.toFixed(2)}`, 14, 39);
    
    let yPos = 50;
    doc.setFontSize(14);
    doc.text('Transaction Summary', 14, yPos);
    yPos += 7;
    
    doc.setFontSize(10);
    Object.entries(typeSummary).forEach(([type, data]) => {
      doc.text(`${getTransactionTypeLabel(type)}: ${data.count} transactions, ₹${data.total.toFixed(2)}`, 14, yPos);
      yPos += 6;
    });
    
    yPos += 5;
    
    const tableData = filteredTransactions.map(txn => {
      const isDebit = txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund';
      return [
        format(new Date(txn.transaction_date), 'dd MMM yyyy'),
        getTransactionTypeLabel(txn.transaction_type),
        getSubTransactionTypeLabel(txn.transaction_sub_type),
        getTransactionDescription(txn),
        isDebit ? '' : `₹${txn.amount.toFixed(2)}`,
        isDebit ? `₹${txn.amount.toFixed(2)}` : ''
      ];
    });

    const totalCredits = filteredTransactions.reduce((sum, txn) => {
      if (txn.transaction_type === 'partner_deposit' || txn.transaction_type === 'income') {
        return sum + txn.amount;
      }
      return sum;
    }, 0);

    const totalDebits = filteredTransactions.reduce((sum, txn) => {
      if (txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund') {
        return sum + txn.amount;
      }
      return sum;
    }, 0);

    tableData.push(['', '', '', 'Total', `₹${totalCredits.toFixed(2)}`, `₹${totalDebits.toFixed(2)}`]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Type', 'Sub Type', 'Description', 'Credit', 'Debit']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' }
    });
    
    const pdfBlob = doc.output('blob');
    await PDFDownloader.downloadPDF(pdfBlob, `${account.account_name}_statement.pdf`);
    toast.success('PDF exported successfully');
  };

  const handleExportExcel = () => {
    if (!account) return;
    
    const excelData = filteredTransactions.map(txn => {
      const isDebit = txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund';
      return {
        Date: format(new Date(txn.transaction_date), 'dd MMM yyyy'),
        Type: getTransactionTypeLabel(txn.transaction_type),
        'Sub Type': getSubTransactionTypeLabel(txn.transaction_sub_type),
        Description: getTransactionDescription(txn),
        Credit: isDebit ? '' : txn.amount,
        Debit: isDebit ? txn.amount : ''
      };
    });

    const totalCredits = filteredTransactions.reduce((sum, txn) => {
      if (txn.transaction_type === 'partner_deposit' || txn.transaction_type === 'income') {
        return sum + txn.amount;
      }
      return sum;
    }, 0);

    const totalDebits = filteredTransactions.reduce((sum, txn) => {
      if (txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund') {
        return sum + txn.amount;
      }
      return sum;
    }, 0);

    excelData.push({
      Date: '',
      Type: '',
      'Sub Type': '',
      Description: 'Total',
      Credit: totalCredits,
      Debit: totalDebits
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `${account.account_name}_statement.xlsx`);
    toast.success('Excel exported successfully');
  };

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!account) {
    return <div className="container mx-auto p-6">Account not found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/firm-accounts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Account Statement - {account.account_name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/transaction-types')}>
            <Plus className="h-4 w-4 mr-2" />
            Manage Types
          </Button>
          <Button onClick={() => setSendMoneyDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Money
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{account.account_type}</p>
            </div>
            {account.account_type === 'bank' && (
              <>
                {account.bank_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Bank</p>
                    <p className="font-medium">{account.bank_name}</p>
                  </div>
                )}
                {account.account_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="font-medium">{account.account_number}</p>
                  </div>
                )}
              </>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className="font-medium">₹{account.opening_balance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="font-bold text-lg">₹{account.current_balance.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Summary Cards */}
      {Object.keys(typeSummary).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {Object.entries(typeSummary).map(([type, data]) => (
            <Card key={type}>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">
                  {getTransactionTypeLabel(type)}
                </div>
                <div className="text-2xl font-bold">₹{data.total.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.count} transaction{data.count !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Transaction History</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by type, description, amount, or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {transactions.length === 0 ? 'No transactions found for this account' : 'No transactions match your search criteria'}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sub Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    {(settings.allowEdit || settings.allowDelete) && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.transaction_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {getTransactionTypeLabel(transaction.transaction_type)}
                    </TableCell>
                    <TableCell>
                      {getSubTransactionTypeLabel(transaction.transaction_sub_type)}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {getTransactionDescription(transaction)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {(transaction.transaction_type === 'partner_deposit' || transaction.transaction_type === 'income') 
                        ? `₹${transaction.amount.toFixed(2)}` 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {(transaction.transaction_type === 'partner_withdrawal' || 
                        transaction.transaction_type === 'expense' ||
                        transaction.transaction_type === 'refund') 
                        ? `₹${transaction.amount.toFixed(2)}` 
                        : '-'}
                    </TableCell>
                    {(settings.allowEdit || settings.allowDelete) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {settings.allowEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTransaction(transaction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {settings.allowDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTransaction(transaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="text-right">Page Total:</TableCell>
                    <TableCell className="text-right text-green-600">₹{pageCredits.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive">₹{pageDebits.toFixed(2)}</TableCell>
                    {(settings.allowEdit || settings.allowDelete) && (
                      <TableCell></TableCell>
                    )}
                  </TableRow>
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </div>
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
        </CardContent>
      </Card>

      <EditFirmTransactionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        transaction={selectedTransaction}
        onTransactionUpdated={handleTransactionUpdated}
      />

      <SendMoneyDialog
        open={sendMoneyDialogOpen}
        onOpenChange={setSendMoneyDialogOpen}
        firmAccountId={account.id}
        firmAccountName={account.account_name}
        onMoneySent={handleTransactionUpdated}
      />
    </div>
  );
}
