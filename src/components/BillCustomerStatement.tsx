import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useControl } from '@/contexts/ControlContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface BillCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
}

interface Sale {
  id: string;
  sale_number: string;
  sale_amount: number;
  sale_date: string;
  due_date: string | null;
  interest_rate: number;
  interest_type: string;
  description: string | null;
  is_active: boolean;
}

interface SaleTransaction {
  id: string;
  sale_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  transaction_type: string;
  notes: string | null;
  sales?: {
    sale_number: string;
  };
}

interface StatementEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'sale' | 'payment' | 'refund';
  id: string;
  transaction_id?: string;
}

interface BillCustomerStatementProps {
  customer: BillCustomer;
}

export function BillCustomerStatement({ customer }: BillCustomerStatementProps) {
  const { user } = useAuth();
  const { settings: controlSettings } = useControl();
  const [sales, setSales] = useState<Sale[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [statement, setStatement] = useState<StatementEntry[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<SaleTransaction | null>(null);
  const [editForm, setEditForm] = useState<{
    amount: string;
    payment_date: string;
    payment_mode: 'cash' | 'bank';
    transaction_type: string;
    notes: string;
  }>({
    amount: '',
    payment_date: '',
    payment_mode: 'cash',
    transaction_type: 'payment',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      fetchCustomerData();
    }
  }, [user, customer.id]);

  useEffect(() => {
    generateStatement();
  }, [sales, transactions, startDate, endDate]);

  const fetchCustomerData = async () => {
    if (!user) return;

    // Fetch sales
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('bill_customer_id', customer.id)
      .eq('user_id', user.id)
      .order('sale_date', { ascending: true });

    if (salesError) {
      console.error('Error fetching sales:', salesError);
      toast.error('Failed to load sales');
      return;
    }

    setSales(salesData || []);

    // Fetch transactions
    if (salesData && salesData.length > 0) {
      const saleIds = salesData.map(s => s.id);
      const { data: transData, error: transError } = await supabase
        .from('sale_transactions')
        .select('*, sales(sale_number)')
        .in('sale_id', saleIds)
        .order('payment_date', { ascending: true });

      if (transError) {
        console.error('Error fetching transactions:', transError);
        toast.error('Failed to load transactions');
        return;
      }

      setTransactions(transData || []);
    }
  };

  const generateStatement = () => {
    const entries: StatementEntry[] = [];
    let runningBalance = 0;

    // Combine sales and transactions
    const allEntries: Array<{
      date: string;
      type: 'sale' | 'payment' | 'refund';
      amount: number;
      description: string;
      id: string;
      transaction_id?: string;
    }> = [];

    // Add sales
    sales.forEach(sale => {
      allEntries.push({
        date: sale.sale_date,
        type: 'sale',
        amount: sale.sale_amount,
        description: `Sale #${sale.sale_number}${sale.description ? ' - ' + sale.description : ''}`,
        id: sale.id
      });
    });

    // Add transactions
    transactions.forEach(trans => {
      // Format the description to show payment details
      let description = trans.transaction_type === 'payment' ? 'Payment Received' : 'Refund';
      if (trans.notes) {
        // If notes contain bill details, format them nicely
        const noteLines = trans.notes.split('\n').filter(line => line.trim());
        if (noteLines.length > 0) {
          description += '\n' + noteLines.join('\n');
        }
      }

      allEntries.push({
        date: trans.payment_date,
        type: trans.transaction_type as 'payment' | 'refund',
        amount: trans.amount,
        description,
        id: trans.sale_id,
        transaction_id: trans.id
      });
    });

    // Sort by date
    allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter by date range if provided
    const filteredEntries = allEntries.filter(entry => {
      if (startDate && new Date(entry.date) < new Date(startDate)) return false;
      if (endDate && new Date(entry.date) > new Date(endDate)) return false;
      return true;
    });

    // Generate statement
    filteredEntries.forEach(entry => {
      let debit = 0;
      let credit = 0;

      if (entry.type === 'sale') {
        debit = entry.amount;
        runningBalance += entry.amount;
      } else if (entry.type === 'payment') {
        credit = entry.amount;
        runningBalance -= entry.amount;
      } else if (entry.type === 'refund') {
        debit = entry.amount;
        runningBalance += entry.amount;
      }

      entries.push({
        date: entry.date,
        description: entry.description,
        debit,
        credit,
        balance: runningBalance,
        type: entry.type,
        id: entry.id,
        transaction_id: entry.transaction_id
      });
    });

    setStatement(entries);
  };

  const handleEdit = (entry: StatementEntry) => {
    if (!entry.transaction_id) return;
    
    const trans = transactions.find(t => t.id === entry.transaction_id);
    if (!trans) return;

    setEditingTransaction(trans);
    setEditForm({
      amount: trans.amount.toString(),
      payment_date: trans.payment_date,
      payment_mode: trans.payment_mode as 'cash' | 'bank',
      transaction_type: trans.transaction_type,
      notes: trans.notes || ''
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async (entry: StatementEntry) => {
    if (!entry.transaction_id) return;
    
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const trans = transactions.find(t => t.id === entry.transaction_id);
    if (!trans) return;

    // Delete the sale transaction
    const { error } = await supabase
      .from('sale_transactions')
      .delete()
      .eq('id', entry.transaction_id);

    if (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
      return;
    }

    // If this was a payment transaction, also delete the corresponding firm transaction
    if (trans.transaction_type === 'payment') {
      const { data: firmTransData } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('transaction_type', 'income')
        .eq('amount', trans.amount)
        .eq('transaction_date', trans.payment_date)
        .ilike('description', `%${customer.name}%`);

      if (firmTransData && firmTransData.length > 0) {
        await supabase
          .from('firm_transactions')
          .delete()
          .eq('id', firmTransData[0].id);
      }
    }

    toast.success('Transaction deleted successfully');
    fetchCustomerData();
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;

    const oldAmount = editingTransaction.amount;
    const newAmount = parseFloat(editForm.amount);
    const oldTransactionType = editingTransaction.transaction_type;
    const newTransactionType = editForm.transaction_type;
    const oldDate = editingTransaction.payment_date;
    const newDate = editForm.payment_date;

    // Update the sale transaction
    const { error } = await supabase
      .from('sale_transactions')
      .update({
        amount: newAmount,
        payment_date: newDate,
        payment_mode: editForm.payment_mode,
        transaction_type: newTransactionType,
        notes: editForm.notes || null
      })
      .eq('id', editingTransaction.id);

    if (error) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
      return;
    }

    // Find and update the corresponding firm transaction
    // Firm transactions are created when recording payments with type 'payment'
    if (oldTransactionType === 'payment' || newTransactionType === 'payment') {
      // Find firm transaction that matches this sale transaction
      // It would have been created with type 'income' and description containing customer name
      const { data: firmTransData } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('transaction_type', 'income')
        .eq('amount', oldAmount)
        .eq('transaction_date', oldDate)
        .ilike('description', `%${customer.name}%`);

      if (firmTransData && firmTransData.length > 0) {
        // Update the firm transaction to match the new sale transaction
        if (newTransactionType === 'payment') {
          await supabase
            .from('firm_transactions')
            .update({
              amount: newAmount,
              transaction_date: newDate,
              description: `Payment received from ${customer.name}`,
            })
            .eq('id', firmTransData[0].id);
        } else {
          // If transaction type changed from payment to refund, delete the firm transaction
          await supabase
            .from('firm_transactions')
            .delete()
            .eq('id', firmTransData[0].id);
        }
      }
    }

    toast.success('Transaction updated successfully');
    setEditDialogOpen(false);
    setEditingTransaction(null);
    fetchCustomerData();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.text('Customer Statement', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Customer Info
    doc.setFontSize(12);
    doc.text(`Customer: ${customer.name}`, 20, yPos);
    yPos += 7;
    if (customer.phone) {
      doc.text(`Phone: ${customer.phone}`, 20, yPos);
      yPos += 7;
    }
    if (customer.gst_number) {
      doc.text(`GST: ${customer.gst_number}`, 20, yPos);
      yPos += 7;
    }
    yPos += 5;

    // Date range
    if (startDate || endDate) {
      doc.text(`Period: ${startDate || 'Start'} to ${endDate || 'End'}`, 20, yPos);
      yPos += 10;
    }

    // Table headers
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    const colWidths = [30, 70, 30, 30, 30];
    let xPos = 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    yPos += 7;

    // Table rows
    doc.setFont('helvetica', 'normal');
    statement.forEach(entry => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      xPos = 15;
      doc.text(new Date(entry.date).toLocaleDateString(), xPos, yPos);
      xPos += colWidths[0];
      doc.text(entry.description.substring(0, 35), xPos, yPos);
      xPos += colWidths[1];
      doc.text(entry.debit ? `₹${entry.debit.toFixed(2)}` : '-', xPos, yPos);
      xPos += colWidths[2];
      doc.text(entry.credit ? `₹${entry.credit.toFixed(2)}` : '-', xPos, yPos);
      xPos += colWidths[3];
      doc.text(`₹${entry.balance.toFixed(2)}`, xPos, yPos);
      yPos += 7;
    });

    // Summary
    yPos += 10;
    const totalDebit = statement.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = statement.reduce((sum, e) => sum + e.credit, 0);
    const finalBalance = statement.length > 0 ? statement[statement.length - 1].balance : 0;

    doc.setFont('helvetica', 'bold');
    doc.text(`Total Sales: ₹${totalDebit.toFixed(2)}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Payments: ₹${totalCredit.toFixed(2)}`, 20, yPos);
    yPos += 7;
    doc.text(`Outstanding Balance: ₹${finalBalance.toFixed(2)}`, 20, yPos);

    doc.save(`${customer.name}_statement.pdf`);
  };

  const totalDebit = statement.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = statement.reduce((sum, e) => sum + e.credit, 0);
  const outstandingBalance = statement.length > 0 ? statement[statement.length - 1].balance : 0;

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statement Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={exportToPDF} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Total Sales</div>
              <div className="text-2xl font-bold">₹{totalDebit.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Payments</div>
              <div className="text-2xl font-bold text-green-600">₹{totalCredit.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Outstanding Balance</div>
              <div className="text-2xl font-bold text-red-600">₹{outstandingBalance.toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {statement.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found for the selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    {(controlSettings.allowEdit || controlSettings.allowDelete) && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.map((entry, index) => (
                    <TableRow key={`${entry.id}-${index}`}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell className="whitespace-pre-line">{entry.description}</TableCell>
                      <TableCell className="text-right">
                        {entry.debit ? `₹${entry.debit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {entry.credit ? `₹${entry.credit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹{entry.balance.toFixed(2)}
                      </TableCell>
                      {(controlSettings.allowEdit || controlSettings.allowDelete) && (
                        <TableCell className="text-right">
                          {entry.transaction_id && (
                            <div className="flex gap-2 justify-end">
                              {controlSettings.allowEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(entry)}
                                  title="Edit Transaction"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {controlSettings.allowDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(entry)}
                                  title="Delete Transaction"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Transaction Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={editForm.payment_date}
                onChange={(e) => setEditForm({ ...editForm, payment_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select
                value={editForm.payment_mode}
                onValueChange={(value: 'cash' | 'bank') => setEditForm({ ...editForm, payment_mode: value })}
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
            <div>
              <Label>Transaction Type</Label>
              <Select
                value={editForm.transaction_type}
                onValueChange={(value) => setEditForm({ ...editForm, transaction_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
