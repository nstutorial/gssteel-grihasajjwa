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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CalendarIcon, XCircle, Calendar as CalendarEdit, DollarSign } from 'lucide-react';
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

interface MahajanPaymentSchedule {
  id: string;
  name: string;
  payment_day: string;
  outstanding_amount: number;
  last_payment_amount: number | null;
  last_payment_date: string | null;
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
  
  const [selectedPaymentDay, setSelectedPaymentDay] = useState<string>('Monday');
  const [mahajanSchedules, setMahajanSchedules] = useState<MahajanPaymentSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedMahajanForPayment, setSelectedMahajanForPayment] = useState<MahajanPaymentSchedule | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (user) {
      fetchReminders();
      fetchMahajanSchedules();
    }
  }, [user, selectedDate]);

  useEffect(() => {
    if (user) {
      fetchMahajanSchedules();
    }
  }, [user, selectedPaymentDay]);

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

  const fetchMahajanSchedules = async () => {
    try {
      setLoadingSchedules(true);
      
      // Fetch mahajans with the selected payment day
      const { data: mahajans, error: mahajansError } = await supabase
        .from('mahajans')
        .select('id, name, payment_day')
        .eq('user_id', user?.id)
        .eq('payment_day', selectedPaymentDay);

      if (mahajansError) throw mahajansError;

      const schedules: MahajanPaymentSchedule[] = [];

      for (const mahajan of mahajans || []) {
        // Fetch all active bills for this mahajan
        const { data: bills, error: billsError } = await supabase
          .from('bills')
          .select('id, bill_amount')
          .eq('mahajan_id', mahajan.id)
          .eq('is_active', true);

        if (billsError) throw billsError;

        let totalOutstanding = 0;

        // Calculate outstanding for each bill
        for (const bill of bills || []) {
          const { data: transactions, error: txError } = await supabase
            .from('bill_transactions')
            .select('amount, transaction_type')
            .eq('bill_id', bill.id);

          if (txError) throw txError;

          let totalPaid = 0;
          transactions?.forEach(tx => {
            if (tx.transaction_type === 'payment' || tx.transaction_type === 'principal') {
              totalPaid += parseFloat(tx.amount.toString());
            }
          });

          totalOutstanding += (bill.bill_amount - totalPaid);
        }

        // Get last payment for this mahajan
        const { data: lastPayment, error: lastPaymentError } = await supabase
          .from('bill_transactions')
          .select('amount, payment_date')
          .in('bill_id', bills?.map(b => b.id) || [])
          .order('payment_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastPaymentError) throw lastPaymentError;

        // Only show mahajans with outstanding balance
        if (totalOutstanding > 0) {
          schedules.push({
            id: mahajan.id,
            name: mahajan.name,
            payment_day: mahajan.payment_day,
            outstanding_amount: totalOutstanding,
            last_payment_amount: lastPayment ? parseFloat(lastPayment.amount.toString()) : null,
            last_payment_date: lastPayment?.payment_date || null,
          });
        }
      }

      setMahajanSchedules(schedules);
    } catch (error: any) {
      console.error('Error fetching mahajan schedules:', error);
      toast.error('Failed to fetch payment schedules');
    } finally {
      setLoadingSchedules(false);
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

  const handleRecordPayment = async () => {
    if (!selectedMahajanForPayment || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      let remainingAmount = parseFloat(paymentAmount);

      // Fetch all active bills for this mahajan, sorted by bill_date
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('id, bill_amount, bill_date, interest_rate, interest_type')
        .eq('mahajan_id', selectedMahajanForPayment.id)
        .eq('is_active', true)
        .order('bill_date', { ascending: true });

      if (billsError) throw billsError;

      for (const bill of bills || []) {
        if (remainingAmount <= 0) break;

        // Get existing transactions for this bill
        const { data: transactions, error: txError } = await supabase
          .from('bill_transactions')
          .select('amount, transaction_type')
          .eq('bill_id', bill.id);

        if (txError) throw txError;

        let totalPrincipalPaid = 0;
        let totalInterestPaid = 0;

        transactions?.forEach(tx => {
          if (tx.transaction_type === 'payment' || tx.transaction_type === 'principal') {
            totalPrincipalPaid += parseFloat(tx.amount.toString());
          }
          if (tx.transaction_type === 'interest') {
            totalInterestPaid += parseFloat(tx.amount.toString());
          }
        });

        const outstandingPrincipal = bill.bill_amount - totalPrincipalPaid;

        if (outstandingPrincipal <= 0) continue;

        // Calculate interest
        let interest = 0;
        if (bill.interest_type === 'simple' && bill.interest_rate > 0) {
          const daysSinceBill = Math.max(0, Math.floor((new Date(paymentDate).getTime() - new Date(bill.bill_date).getTime()) / (1000 * 60 * 60 * 24)));
          interest = (outstandingPrincipal * bill.interest_rate * daysSinceBill) / (100 * 365);
        } else if (bill.interest_type === 'flat' && bill.interest_rate > 0) {
          interest = (outstandingPrincipal * bill.interest_rate) / 100;
        }

        const outstandingInterest = Math.max(0, interest - totalInterestPaid);

        // Pay interest first
        if (outstandingInterest > 0 && remainingAmount > 0) {
          const interestPayment = Math.min(outstandingInterest, remainingAmount);
          
          const { error: interestError } = await supabase
            .from('bill_transactions')
            .insert([{
              bill_id: bill.id,
              amount: interestPayment,
              transaction_type: 'interest',
              payment_date: paymentDate,
              payment_mode: paymentMode as any,
              notes: paymentNotes || `Interest payment for ${selectedMahajanForPayment.name}`,
            }]);

          if (interestError) throw interestError;
          remainingAmount -= interestPayment;
        }

        // Pay principal
        if (remainingAmount > 0) {
          const principalPayment = Math.min(outstandingPrincipal, remainingAmount);
          
          const { error: principalError } = await supabase
            .from('bill_transactions')
            .insert([{
              bill_id: bill.id,
              amount: principalPayment,
              transaction_type: 'principal',
              payment_date: paymentDate,
              payment_mode: paymentMode as any,
              notes: paymentNotes || `Principal payment for ${selectedMahajanForPayment.name}`,
            }]);

          if (principalError) throw principalError;
          remainingAmount -= principalPayment;

          // Check if bill is fully paid
          const newOutstanding = outstandingPrincipal - principalPayment;
          if (newOutstanding <= 0.01) {
            await supabase
              .from('bills')
              .update({ is_active: false })
              .eq('id', bill.id);
          }
        }
      }

      toast.success('Payment recorded successfully');
      setPaymentDialog(false);
      setSelectedMahajanForPayment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchMahajanSchedules();
      fetchReminders();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
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

        {/* Daywise Payment Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Daywise Payment Schedule for Mahajans/Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Day Selector */}
              <div className="flex gap-2 flex-wrap">
                {daysOfWeek.map((day) => (
                  <Button
                    key={day}
                    variant={selectedPaymentDay === day ? 'default' : 'outline'}
                    onClick={() => setSelectedPaymentDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>

              {/* Mahajan Schedule Table */}
              {loadingSchedules ? (
                <LoadingSpinner message="Loading payment schedules..." />
              ) : mahajanSchedules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No mahajans scheduled for {selectedPaymentDay}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mahajan/Supplier</TableHead>
                        <TableHead>Payment Day</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Last Payment Amount</TableHead>
                        <TableHead>Last Payment Date</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mahajanSchedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">{schedule.name}</TableCell>
                          <TableCell>{schedule.payment_day}</TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            ₹{schedule.outstanding_amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {schedule.last_payment_amount 
                              ? `₹${schedule.last_payment_amount.toFixed(2)}` 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {schedule.last_payment_date 
                              ? format(new Date(schedule.last_payment_date), 'PP') 
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedMahajanForPayment(schedule);
                                setPaymentDialog(true);
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Record Payment
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
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

        {/* Record Payment Dialog */}
        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-semibold">Mahajan: {selectedMahajanForPayment?.name}</Label>
                <Label className="text-red-600">Total Outstanding: ₹{selectedMahajanForPayment?.outstanding_amount.toFixed(2)}</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Payment Amount *</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-date">Payment Date *</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-mode">Payment Mode *</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notes (Optional)</Label>
                <Textarea
                  id="payment-notes"
                  placeholder="Enter any additional notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRecordPayment}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BillReminders;
