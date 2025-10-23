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
import { ArrowLeft, CalendarIcon, XCircle, Calendar as CalendarEdit } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/LoadingSpinner';

interface BillReminder {
  id: string;
  bill_number: string;
  mahajan_name: string;
  mahajan_id: string;
  bill_amount: number;
  due_date: string;
  interest_rate: number;
  interest_type: string;
  amount_due: number;
  outstanding_balance: number;
  bill_date: string;
}

const BillReminders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reminders, setReminders] = useState<BillReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueDateDialog, setDueDateDialog] = useState(false);
  const [selectedBillForDueDate, setSelectedBillForDueDate] = useState<BillReminder | null>(null);
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

      // Fetch all bills with due dates on or before selected date that are still active
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select(`
          id,
          bill_number,
          bill_amount,
          due_date,
          bill_date,
          interest_rate,
          interest_type,
          is_active,
          mahajan_id,
          mahajans (
            name
          )
        `)
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .not('due_date', 'is', null)
        .lte('due_date', dateStr)
        .order('due_date', { ascending: true });

      if (billsError) throw billsError;

      // For each bill, calculate outstanding balance
      const remindersData: BillReminder[] = [];

      for (const bill of bills || []) {
        // Fetch all transactions for this bill
        const { data: transactions, error: txError } = await supabase
          .from('bill_transactions')
          .select('amount, transaction_type')
          .eq('bill_id', bill.id);

        if (txError) throw txError;

        // Calculate total paid and interest
        let totalPaid = 0;
        let totalInterestPaid = 0;

        transactions?.forEach(tx => {
          if (tx.transaction_type === 'payment' || tx.transaction_type === 'principal') {
            totalPaid += parseFloat(tx.amount.toString());
          }
          if (tx.transaction_type === 'interest') {
            totalInterestPaid += parseFloat(tx.amount.toString());
          }
        });

        // Calculate outstanding amount
        const balance = bill.bill_amount - totalPaid;
        
        // Calculate interest on balance
        let interest = 0;
        if (bill.interest_type === 'simple' && bill.interest_rate > 0) {
          const daysSinceDue = Math.max(0, Math.floor((new Date(dateStr).getTime() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24)));
          interest = (balance * bill.interest_rate * daysSinceDue) / (100 * 365);
        } else if (bill.interest_type === 'flat' && bill.interest_rate > 0) {
          interest = (balance * bill.interest_rate) / 100;
        }

        const amountDue = balance + Math.max(0, interest - totalInterestPaid);

        // Only show if there's an outstanding balance
        if (balance > 0) {
          remindersData.push({
            id: bill.id,
            bill_number: bill.bill_number || 'N/A',
            mahajan_name: bill.mahajans?.name || 'Unknown',
            mahajan_id: bill.mahajan_id,
            bill_amount: bill.bill_amount,
            due_date: bill.due_date,
            bill_date: bill.bill_date,
            interest_rate: bill.interest_rate || 0,
            interest_type: bill.interest_type || 'none',
            amount_due: amountDue,
            outstanding_balance: balance,
          });
        }
      }

      setReminders(remindersData);
    } catch (error: any) {
      console.error('Error fetching bill reminders:', error);
      toast.error('Failed to fetch bill reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDueDate = async () => {
    if (!selectedBillForDueDate || !newDueDate) return;

    try {
      const { error } = await supabase
        .from('bills')
        .update({ due_date: newDueDate })
        .eq('id', selectedBillForDueDate.id);

      if (error) throw error;

      toast.success('Due date updated successfully');
      setDueDateDialog(false);
      setSelectedBillForDueDate(null);
      setNewDueDate('');
      fetchReminders();
    } catch (error: any) {
      console.error('Error updating due date:', error);
      toast.error('Failed to update due date');
    }
  };

  const totalDue = reminders.reduce((sum, r) => sum + r.amount_due, 0);
  const totalOutstanding = reminders.reduce((sum, r) => sum + r.outstanding_balance, 0);

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
              <h1 className="text-3xl font-bold">Bill Reminders</h1>
              <p className="text-muted-foreground">Track overdue bills with pending payments</p>
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
              <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{reminders.length}</div>
              <p className="text-xs text-muted-foreground">Due on or before selected date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalOutstanding.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Principal balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Amount Due (with Interest)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{totalDue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Including interest</p>
            </CardContent>
          </Card>
        </div>

        {/* Reminders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Bills Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSpinner message="Loading bill reminders..." />
            ) : reminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No overdue bills for {format(selectedDate, 'PPP')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mahajan</TableHead>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Bill Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Bill Amount</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell className="font-medium">{reminder.mahajan_name}</TableCell>
                        <TableCell>{reminder.bill_number}</TableCell>
                        <TableCell>{format(new Date(reminder.bill_date), 'PP')}</TableCell>
                        <TableCell>{format(new Date(reminder.due_date), 'PP')}</TableCell>
                        <TableCell className="text-right">₹{reminder.bill_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">
                          ₹{reminder.outstanding_balance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          ₹{reminder.amount_due.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedBillForDueDate(reminder);
                              setNewDueDate(reminder.due_date);
                              setDueDateDialog(true);
                            }}
                          >
                            <CalendarEdit className="h-4 w-4 mr-1" />
                            Set Due Date
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Set Due Date Dialog */}
        <Dialog open={dueDateDialog} onOpenChange={setDueDateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set New Due Date</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Mahajan: {selectedBillForDueDate?.mahajan_name}</Label>
                <Label>Bill #: {selectedBillForDueDate?.bill_number}</Label>
                <Label>Outstanding: ₹{selectedBillForDueDate?.outstanding_balance.toFixed(2)}</Label>
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

export default BillReminders;
