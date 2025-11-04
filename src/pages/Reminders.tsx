import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CalendarIcon, CheckCircle2, XCircle, Calendar as CalendarEdit } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/LoadingSpinner';

interface LoanReminder {
  id: string;
  loan_number: string;
  customer_name: string;
  customer_id: string;
  principal_amount: number;
  due_date: string;
  interest_rate: number;
  interest_type: string;
  amount_due: number;
  outstanding_balance: number;
  is_collected: boolean;
  collection_date: string | null;
}

const Reminders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reminders, setReminders] = useState<LoanReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueDateDialog, setDueDateDialog] = useState(false);
  const [selectedLoanForDueDate, setSelectedLoanForDueDate] = useState<LoanReminder | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    if (user) {
      fetchReminders();
    }
  }, [user, selectedDate]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Fetch all loans with due dates on or before selected date that are still active
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select(`
          id,
          loan_number,
          principal_amount,
          total_outstanding,
          due_date,
          interest_rate,
          interest_type,
          is_active,
          customer_id,
          customers (
            name
          )
        `)
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .not('due_date', 'is', null)
        .lte('due_date', dateStr)
        .order('due_date', { ascending: true });

      if (loansError) throw loansError;

      // For each loan, check if payment was made on or after due date
      const remindersData: LoanReminder[] = [];

      for (const loan of loans || []) {
        // Fetch all transactions for this loan
        const { data: transactions, error: txError } = await supabase
          .from('loan_transactions')
          .select('amount, payment_date, transaction_type')
          .eq('loan_id', loan.id)
          .order('payment_date', { ascending: true });

        if (txError) throw txError;

        // Calculate total paid and interest
        let totalPaid = 0;
        let totalInterestPaid = 0;
        let isCollected = false;
        let collectionDate = null;

        transactions?.forEach(tx => {
          if (tx.transaction_type === 'payment' || tx.transaction_type === 'principal') {
            totalPaid += parseFloat(tx.amount.toString());
          }
          if (tx.transaction_type === 'interest') {
            totalInterestPaid += parseFloat(tx.amount.toString());
          }

          // Check if payment made on selected date only
          if (tx.payment_date === dateStr) {
            isCollected = true;
            collectionDate = tx.payment_date;
          }
        });

        // Calculate outstanding amount (use total_outstanding instead of principal_amount)
        const balance = (loan.total_outstanding || loan.principal_amount) - totalPaid;
        
        // Calculate interest on balance
        let interest = 0;
        if (loan.interest_type === 'simple' && loan.interest_rate > 0) {
          const daysSinceDue = Math.max(0, Math.floor((new Date(dateStr).getTime() - new Date(loan.due_date).getTime()) / (1000 * 60 * 60 * 24)));
          interest = (balance * loan.interest_rate * daysSinceDue) / (100 * 365);
        } else if (loan.interest_type === 'flat' && loan.interest_rate > 0) {
          interest = (balance * loan.interest_rate) / 100;
        }

        const amountDue = balance + Math.max(0, interest - totalInterestPaid);

        // Only show if:
        // 1. There's an outstanding balance AND it's pending (not collected)
        // 2. OR it was collected on the selected date (to show today's collections)
        if (balance > 0 && (!isCollected || (isCollected && collectionDate === dateStr))) {
          remindersData.push({
            id: loan.id,
            loan_number: loan.loan_number || 'N/A',
            customer_name: loan.customers?.name || 'Unknown',
            customer_id: loan.customer_id,
            principal_amount: loan.principal_amount,
            due_date: loan.due_date,
            interest_rate: loan.interest_rate || 0,
            interest_type: loan.interest_type || 'none',
            amount_due: amountDue,
            outstanding_balance: balance,
            is_collected: isCollected,
            collection_date: collectionDate,
          });
        }
      }

      setReminders(remindersData);
    } catch (error: any) {
      console.error('Error fetching reminders:', error);
      toast.error('Failed to fetch reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDueDate = async () => {
    if (!selectedLoanForDueDate || !newDueDate) return;

    try {
      const { error } = await supabase
        .from('loans')
        .update({ due_date: newDueDate })
        .eq('id', selectedLoanForDueDate.id);

      if (error) throw error;

      toast.success('Due date updated successfully');
      setDueDateDialog(false);
      setSelectedLoanForDueDate(null);
      setNewDueDate('');
      fetchReminders();
    } catch (error: any) {
      console.error('Error updating due date:', error);
      toast.error('Failed to update due date');
    }
  };

  const collectedCount = reminders.filter(r => r.is_collected).length;
  const pendingCount = reminders.filter(r => !r.is_collected).length;
  const totalDue = reminders.reduce((sum, r) => sum + r.amount_due, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Collection Reminders</h1>
              <p className="text-muted-foreground">Track loan collections by due date</p>
            </div>
          </div>

          {/* Date Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reminders.length}</div>
              <p className="text-xs text-muted-foreground">Due on or before selected date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{collectedCount}</div>
              <p className="text-xs text-muted-foreground">Payments received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting collection</p>
            </CardContent>
          </Card>
        </div>

        {/* Reminders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Collection Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSpinner message="Loading reminders..." />
            ) : reminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No loan reminders for {format(selectedDate, 'PPP')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Loan #</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Collection Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell className="font-medium">{reminder.customer_name}</TableCell>
                        <TableCell>{reminder.loan_number}</TableCell>
                        <TableCell>{format(new Date(reminder.due_date), 'PPP')}</TableCell>
                        <TableCell className="text-right">₹{reminder.principal_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">₹{reminder.amount_due.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">
                          ₹{reminder.outstanding_balance.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {reminder.is_collected ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Collected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {reminder.collection_date ? format(new Date(reminder.collection_date), 'PPP') : '-'}
                        </TableCell>
                        <TableCell>
                          {reminder.outstanding_balance > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLoanForDueDate(reminder);
                                setNewDueDate(reminder.due_date);
                                setDueDateDialog(true);
                              }}
                            >
                              <CalendarEdit className="h-4 w-4 mr-1" />
                              Set Due Date
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Footer */}
        {reminders.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount Due</p>
                  <p className="text-2xl font-bold">₹{totalDue.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Collection Rate</p>
                  <p className="text-2xl font-bold">
                    {reminders.length > 0 ? Math.round((collectedCount / reminders.length) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Set Due Date Dialog */}
        <Dialog open={dueDateDialog} onOpenChange={setDueDateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set New Due Date</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Customer: {selectedLoanForDueDate?.customer_name}</Label>
                <Label>Loan #: {selectedLoanForDueDate?.loan_number}</Label>
                <Label>Outstanding: ₹{selectedLoanForDueDate?.outstanding_balance.toFixed(2)}</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-due-date">New Due Date</Label>
                <Input
                  id="new-due-date"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDueDateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetDueDate}>Update Due Date</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Reminders;
