import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import CustomerDetails from '@/components/CustomerDetails';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, CreditCard, User, Phone, MapPin, IndianRupee, Plus, Eye, Download, Edit, Printer, Share as ShareIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { Share } from '@capacitor/share';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
  loans?: Array<{
    id: string;
    principal_amount: number;
    processing_fee?: number;
    total_outstanding?: number;
    is_active: boolean;
    interest_rate: number;
    interest_type: string;
    loan_date: string;
    emi_amount?: number;
  }>;
}

interface CollectionPageProps {
  selectedDay?: string;
}

const CollectionPage = ({ selectedDay }: CollectionPageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dayFromUrl = searchParams.get('day');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('scheduled');
  const [paymentData, setPaymentData] = useState<{[key: string]: {
    amount: string;
    notes: string;
    transaction_type: 'principal' | 'interest' | 'mixed';
    payment_mode: 'cash' | 'bank';
  }}>({});
  
  const [editingPayments, setEditingPayments] = useState<{[key: string]: {
    [paymentId: string]: {
      amount: string;
      notes: string;
      transaction_type: 'principal' | 'interest' | 'mixed';
      payment_mode: 'cash' | 'bank';
    };
  }}>({});
  const [showPaymentForm, setShowPaymentForm] = useState<{[key: string]: boolean}>({});
  const [paymentErrors, setPaymentErrors] = useState<{[key: string]: string}>({});
  const [confirmedTransactions, setConfirmedTransactions] = useState<{[key: string]: boolean}>({});
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const dayLabels = {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday'
  };

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Fetch customers with their loans
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          loans:loans(id, principal_amount, processing_fee, total_outstanding, is_active, interest_rate, interest_type, loan_date, emi_amount)
        `)
        .eq('user_id', user?.id)
        .order('name');

      if (customersError) throw customersError;

      // Fetch all loan transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans!inner(customer_id, user_id)
        `)
        .eq('loan.user_id', user?.id);

      if (transactionsError) throw transactionsError;

      setCustomers(customersData || []);
      setAllTransactions(transactionsData || []);

      // Load confirmed transactions
      const confirmedMap: {[key: string]: boolean} = {};
      (transactionsData || []).forEach((transaction: any) => {
        if (transaction.is_confirmed) {
          confirmedMap[transaction.id] = true;
        }
      });
      setConfirmedTransactions(confirmedMap);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch customers",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateLoanBalance = (customerId: string, loanId: string) => {
    const customerLoans = allTransactions.filter(t => t.loan.customer_id === customerId && t.loan_id === loanId);
    const totalPaid = customerLoans.reduce((sum, t) => sum + t.amount, 0);
    const loan = customers.find(c => c.id === customerId)?.loans?.find(l => l.id === loanId);
    return loan ? loan.principal_amount - totalPaid : 0;
  };

  const calculateInterest = (loan: any, balance: number) => {
    if (!loan.interest_rate || loan.interest_type === 'none') return 0;
    
    const rate = loan.interest_rate / 100;
    const startDate = new Date(loan.loan_date);
    const endDate = new Date();
    
    if (loan.interest_type === 'daily') {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30;
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateCustomerOutstanding = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      // Get initial total outstanding
      const initialOutstanding = loan.total_outstanding || 0;
      
      // Calculate total payments made for this loan
      const loanPayments = allTransactions.filter(t => t.loan_id === loan.id);
      const totalPaid = loanPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      
      // Current outstanding = initial outstanding - total paid
      const currentOutstanding = initialOutstanding - totalPaid;
      
      return sum + Math.max(0, currentOutstanding); // Ensure it doesn't go negative
    }, 0);
  };

  const calculateCustomerEMIAmount = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      const emiAmount = parseFloat(((loan as any).emi_amount || 0).toString());
      return sum + (isNaN(emiAmount) ? 0 : emiAmount);
    }, 0);
  };

  const calculateCustomerEMIsPaid = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      const loanTransactions = allTransactions.filter(t => t.loan_id === loan.id);
      return sum + loanTransactions.length;
    }, 0);
  };

  const calculateCustomerTotalEMIPaid = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      const loanTransactions = allTransactions.filter(t => t.loan_id === loan.id);
      return sum + loanTransactions.reduce((transactionSum, transaction) => transactionSum + transaction.amount, 0);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getTodayCollectedCustomers = () => {
    const today = new Date().toISOString().split('T')[0];
    return customers.filter(customer => {
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      return activeLoans.some(loan => {
        const loanTransactions = allTransactions.filter(t => t.loan_id === loan.id);
        return loanTransactions.some(transaction => 
          transaction.payment_date === today
        );
      });
    });
  };

  const getTodayCollectionStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayCollectedCustomers = getTodayCollectedCustomers();
    
    // Calculate total collected amount
    const totalCollected = todayCollectedCustomers.reduce((sum, customer) => {
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      const todayPayments = activeLoans.flatMap(loan => 
        allTransactions.filter(t => 
          t.loan_id === loan.id && t.payment_date === today
        )
      );
      return sum + todayPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
    }, 0);

    // Count customers who paid EMI
    const customersPaidEMI = todayCollectedCustomers.length;

    // Count customers who were scheduled for collection today
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const scheduledCustomers = customers.filter(customer => customer.payment_day === todayDay);
    const scheduledCount = scheduledCustomers.length;

    // Count customers who paid less than EMI
    const customersPaidLess = todayCollectedCustomers.filter(customer => {
      const emiAmount = calculateCustomerEMIAmount(customer);
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      const todayPayments = activeLoans.flatMap(loan => 
        allTransactions.filter(t => 
          t.loan_id === loan.id && t.payment_date === today
        )
      );
      const totalPaid = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
      return emiAmount > 0 && totalPaid < emiAmount;
    }).length;

    // Count customers who paid more than EMI
    const customersPaidMore = todayCollectedCustomers.filter(customer => {
      const emiAmount = calculateCustomerEMIAmount(customer);
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      const todayPayments = activeLoans.flatMap(loan => 
        allTransactions.filter(t => 
          t.loan_id === loan.id && t.payment_date === today
        )
      );
      const totalPaid = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
      return emiAmount > 0 && totalPaid > emiAmount;
    }).length;

    // Calculate today's loan disbursement
    const todayLoans = customers.flatMap(customer => 
      customer.loans?.filter(loan => 
        loan.loan_date === today && loan.is_active
      ) || []
    );
    const todayDisbursement = todayLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);

    // Calculate pending collection amount and count for today
    const scheduledCustomersToday = getScheduledCustomers();
    let pendingCollectionAmount = 0;
    let pendingCustomersCount = 0;
    
    scheduledCustomersToday.forEach(customer => {
      const emiAmount = calculateCustomerEMIAmount(customer);
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      const todayPayments = activeLoans.flatMap(loan => 
        allTransactions.filter(t => 
          t.loan_id === loan.id && t.payment_date === today
        )
      );
      const totalPaid = todayPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      
      // If customer hasn't paid their EMI, add the remaining amount to pending
      if (emiAmount > 0 && totalPaid < emiAmount) {
        pendingCollectionAmount += (emiAmount - totalPaid);
        pendingCustomersCount++;
      }
    });

    return {
      totalCollected,
      customersPaidEMI,
      scheduledCount,
      customersPaidLess,
      customersPaidMore,
      todayDisbursement,
      pendingCollectionAmount,
      pendingCustomersCount
    };
  };

  const getScheduledCustomers = () => {
    const today = new Date().toISOString().split('T')[0];
    
    return customers.filter(customer => {
      // Filter by day if specified
      const dayFilter = selectedDay || dayFromUrl;
      if (dayFilter && customer.payment_day !== dayFilter) {
        return false;
      }
      
      // Exclude customers who have already paid today
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      const hasPaidToday = activeLoans.some(loan => {
        const loanTransactions = allTransactions.filter(t => t.loan_id === loan.id);
        return loanTransactions.some(transaction => 
          transaction.payment_date === today
        );
      });
      
      if (hasPaidToday) {
        return false;
      }
      
      // Exclude customers with outstanding balance <= 0
      const outstandingBalance = calculateCustomerOutstanding(customer);
      if (outstandingBalance <= 0) {
        return false;
      }
      
      // Filter by search query
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        customer.name.toLowerCase().includes(query) ||
        (customer.phone && customer.phone.includes(query)) ||
        (customer.address && customer.address.toLowerCase().includes(query)) ||
        (customer.payment_day && customer.payment_day.toLowerCase().includes(query))
      );
    });
  };

  const filteredCustomers = activeTab === 'scheduled' ? getScheduledCustomers() : getTodayCollectedCustomers();

  // If a customer is selected, show their details
  if (selectedCustomer) {
    return (
      <CustomerDetails
        customer={selectedCustomer}
        onBack={() => {
          setSelectedCustomer(null);
          fetchCustomers(); // Refresh data when coming back
        }}
      />
    );
  }

  const handlePayment = async (customer: Customer) => {
    if (!user) return;
    
    const customerPaymentData = paymentData[customer.id];
    if (!customerPaymentData || !customerPaymentData.amount) return;

    // Calculate outstanding balance for validation
    const outstandingBalance = calculateCustomerOutstanding(customer);
    
    // Final validation before submission
    if (!validatePaymentAmount(customer.id, customerPaymentData.amount, outstandingBalance)) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: paymentErrors[customer.id] || "Please enter a valid payment amount",
      });
      return;
    }

    try {
      // Find the customer's active loan
      const activeLoan = customer.loans?.find(loan => loan.is_active);
      if (!activeLoan) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No active loan found for this customer",
        });
        return;
      }

      const { error } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: activeLoan.id,
          amount: parseFloat(customerPaymentData.amount),
          transaction_type: customerPaymentData.transaction_type,
          payment_mode: customerPaymentData.payment_mode,
          payment_date: new Date().toISOString(),
          notes: customerPaymentData.notes?.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Payment Recorded",
        description: `Payment of ₹${customerPaymentData.amount} recorded for ${customer.name}`,
      });

      // Reset form for this customer
      setPaymentData(prev => ({
        ...prev,
        [customer.id]: {
          amount: '',
          notes: '',
          transaction_type: 'mixed',
          payment_mode: 'cash'
        }
      }));

      // Switch to collected tab to show the payment
      setActiveTab('collected');

      // Refresh data with a small delay to ensure database triggers complete
      setTimeout(() => {
        fetchCustomers();
      }, 300);
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record payment",
      });
    }
  };

  const handleConfirmTransaction = async (customerId: string, transactionId: string, isConfirmed: boolean) => {
    if (!user) return;

    try {
      if (isConfirmed) {
        // Show warning dialog
        const confirmed = window.confirm(
          `Are you sure you want to confirm this transaction for ${customers.find(c => c.id === customerId)?.name}?\n\n` +
          `Once confirmed, this transaction cannot be edited.`
        );
        
        if (!confirmed) {
          return;
        }

        // Update transaction in database
        const { error } = await supabase
          .from('loan_transactions')
          .update({
            is_confirmed: true,
            confirmed_at: new Date().toISOString(),
            confirmed_by: user.id
          } as any)
          .eq('id', transactionId);

        if (error) throw error;

        // Update local state
        setConfirmedTransactions(prev => ({
          ...prev,
          [transactionId]: true
        }));

        toast({
          title: "Transaction Confirmed",
          description: "This transaction has been confirmed and cannot be edited",
        });
      } else {
        // Unconfirm transaction (if needed in the future)
        const { error } = await supabase
          .from('loan_transactions')
          .update({
            is_confirmed: false,
            confirmed_at: null,
            confirmed_by: null
          } as any)
          .eq('id', transactionId);

        if (error) throw error;

        setConfirmedTransactions(prev => ({
          ...prev,
          [transactionId]: false
        }));
      }
    } catch (error) {
      console.error('Error confirming transaction:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to confirm transaction",
      });
    }
  };

  const updatePaymentData = (customerId: string, field: string, value: string, outstandingBalance?: number) => {
    setPaymentData(prev => ({
      ...prev,
      [customerId]: {
        ...getCustomerPaymentData(customerId),
        [field]: value
      }
    }));

    // Validate amount if field is 'amount' and outstanding balance is provided
    if (field === 'amount' && outstandingBalance !== undefined) {
      validatePaymentAmount(customerId, value, outstandingBalance);
    }
  };

  const togglePaymentForm = (customerId: string) => {
    setShowPaymentForm(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }));
  };

  const validatePaymentAmount = (customerId: string, amount: string, outstandingBalance: number) => {
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setPaymentErrors(prev => ({
        ...prev,
        [customerId]: 'Amount must be greater than 0'
      }));
      return false;
    }
    
    if (numericAmount > outstandingBalance) {
      setPaymentErrors(prev => ({
        ...prev,
        [customerId]: `Amount cannot exceed outstanding balance of ₹${outstandingBalance.toFixed(2)}`
      }));
      return false;
    }
    
    // Clear error if validation passes
    setPaymentErrors(prev => ({
      ...prev,
      [customerId]: ''
    }));
    return true;
  };

  const updateEditingPayment = (customerId: string, paymentId: string, field: string, value: string) => {
    setEditingPayments(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [paymentId]: {
          ...prev[customerId]?.[paymentId],
          [field]: value
        }
      }
    }));
  };

  const startEditingPayment = (customerId: string, payment: any) => {
    setEditingPayments(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [payment.id]: {
          amount: payment.amount.toString(),
          notes: payment.notes || '',
          transaction_type: payment.transaction_type,
          payment_mode: payment.payment_mode
        }
      }
    }));
  };

  const cancelEditingPayment = (customerId: string, paymentId: string) => {
    setEditingPayments(prev => {
      const newState = { ...prev };
      if (newState[customerId]) {
        delete newState[customerId][paymentId];
        if (Object.keys(newState[customerId]).length === 0) {
          delete newState[customerId];
        }
      }
      return newState;
    });
  };

  const saveEditedPayment = async (customerId: string, paymentId: string) => {
    const editedPayment = editingPayments[customerId]?.[paymentId];
    if (!editedPayment) return;

    const newAmount = parseFloat(editedPayment.amount);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount greater than 0.",
      });
      return;
    }

    try {
      // Get the original transaction to find the loan
      const { data: originalTransaction, error: fetchError } = await supabase
        .from('loan_transactions')
        .select('*, loan:loans!inner(id, interest_rate, interest_type, loan_date, customer_id)')
        .eq('id', paymentId)
        .single();

      if (fetchError) throw fetchError;
      if (!originalTransaction) {
        throw new Error('Transaction not found');
      }

      const loanId = originalTransaction.loan_id;
      const loan = originalTransaction.loan;

      // Calculate current balance and interest (excluding this payment)
      const loanTransactions = allTransactions.filter(t => 
        t.loan_id === loanId && t.id !== paymentId
      );
      const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
      const customer = customers.find(c => c.id === customerId);
      const loanDetails = customer?.loans?.find(l => l.id === loanId);
      
      if (!loanDetails) {
        throw new Error('Loan not found');
      }

      const currentBalance = loanDetails.principal_amount - totalPaid;
      const currentInterest = calculateInterest(loan, currentBalance);

      // Calculate the split: interest first, then principal
      let interestPayment = 0;
      let principalPayment = 0;

      if (currentInterest > 0 && newAmount > 0) {
        interestPayment = Math.min(newAmount, currentInterest);
        principalPayment = newAmount - interestPayment;
      } else {
        principalPayment = newAmount;
      }

      // Delete the old transaction
      const { error: deleteError } = await supabase
        .from('loan_transactions')
        .delete()
        .eq('id', paymentId);

      if (deleteError) throw deleteError;

      // Insert new transaction(s) with proper split
      const transactions = [];
      if (interestPayment > 0) {
        transactions.push({
          loan_id: loanId,
          amount: interestPayment,
          transaction_type: 'interest',
          payment_mode: editedPayment.payment_mode,
          payment_date: originalTransaction.payment_date,
          notes: editedPayment.notes?.trim() || null,
        });
      }
      if (principalPayment > 0) {
        transactions.push({
          loan_id: loanId,
          amount: principalPayment,
          transaction_type: 'principal',
          payment_mode: editedPayment.payment_mode,
          payment_date: originalTransaction.payment_date,
          notes: editedPayment.notes?.trim() || null,
        });
      }

      const { error: insertError } = await supabase
        .from('loan_transactions')
        .insert(transactions);

      if (insertError) throw insertError;

      let description = `Payment updated to ₹${newAmount.toFixed(2)}`;
      if (interestPayment > 0 && principalPayment > 0) {
        description += ` (₹${interestPayment.toFixed(2)} interest + ₹${principalPayment.toFixed(2)} principal)`;
      } else if (interestPayment > 0) {
        description += ` (interest only)`;
      } else {
        description += ` (principal only)`;
      }

      toast({
        title: "Payment Updated",
        description,
      });

      // Refresh data with a small delay to ensure database triggers complete
      setTimeout(() => {
        fetchCustomers();
        cancelEditingPayment(customerId, paymentId);
      }, 300);
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update payment. Please try again.",
      });
    }
  };

  const getCustomerPaymentData = (customerId: string) => {
    return paymentData[customerId] || {
      amount: '',
      notes: '',
      transaction_type: 'mixed' as 'principal' | 'interest' | 'mixed',
      payment_mode: 'cash' as 'cash' | 'bank'
    };
  };

  // Helper function to wrap text in PDF cells
  const wrapText = (doc: jsPDF, text: string, maxWidth: number, fontSize: number = 8) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    return lines;
  };

  const areAllTransactionsConfirmed = () => {
    const collectedCustomers = getTodayCollectedCustomers();
    
    if (collectedCustomers.length === 0) {
      return false; // No collected customers, so no transactions to confirm
    }

    const today = new Date().toISOString().split('T')[0];
    
    for (const customer of collectedCustomers) {
      const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
      const todayPayments = activeLoans.flatMap(loan => 
        allTransactions.filter(t => 
          t.loan_id === loan.id && t.payment_date === today
        )
      );
      
      // Check if any transaction for this customer is not confirmed
      for (const payment of todayPayments) {
        if (!confirmedTransactions[payment.id]) {
          return false;
        }
      }
    }
    
    return true;
  };

  const shareCollectionReport = async () => {
    try {
      const today = new Date();
      const todayStr = format(today, 'dd/MM/yyyy');
      const stats = getTodayCollectionStats();
      const collectedCustomers = getTodayCollectedCustomers();

      // Create a summary text for sharing
      let shareText = `📊 Payment Collection Report - ${todayStr}\n\n`;
      shareText += `💰 Total Collected: ₹${stats.totalCollected.toFixed(2)}\n`;
      shareText += `👥 Customers Paid EMI: ${stats.customersPaidEMI}\n`;
      shareText += `📅 Scheduled for Collection: ${stats.scheduledCount}\n`;
      shareText += `📉 Paid Less than EMI: ${stats.customersPaidLess}\n`;
      shareText += `📈 Paid More than EMI: ${stats.customersPaidMore}\n`;
      shareText += `💸 Today's Loan Disbursement: ₹${stats.todayDisbursement.toFixed(2)}\n\n`;

      if (collectedCustomers.length > 0) {
        shareText += `📋 Collected Customers (${collectedCustomers.length}):\n`;
        collectedCustomers.forEach((customer, index) => {
          const outstandingBalance = calculateCustomerOutstanding(customer);
          const emiAmount = calculateCustomerEMIAmount(customer);
          const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
          const today = new Date().toISOString().split('T')[0];
          
          const todayPayments = activeLoans.flatMap(loan => 
            allTransactions.filter(t => 
              t.loan_id === loan.id && t.payment_date === today
            )
          );
          
          const totalTodayPayment = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);

          shareText += `${index + 1}. ${customer.name}`;
          if (customer.payment_day) {
            shareText += ` (${dayLabels[customer.payment_day.toLowerCase() as keyof typeof dayLabels] || customer.payment_day})`;
          }
          shareText += `\n   📞 ${customer.phone || 'N/A'}`;
          shareText += `\n   💰 Collected: ₹${totalTodayPayment.toFixed(2)}`;
          shareText += `\n   📊 Outstanding: ₹${outstandingBalance.toFixed(2)}`;
          shareText += `\n   💳 EMI: ₹${emiAmount.toFixed(2)}\n\n`;
        });
      } else {
        shareText += `📝 No payments collected today.\n\n`;
      }

      shareText += `📱 Generated by Griha Sajjwa App\n`;
      shareText += `📧 Email: ${user?.email || 'N/A'}\n`;
      shareText += `🕐 ${format(today, 'dd/MM/yyyy HH:mm')}`;

      // Use Capacitor Share plugin
      await Share.share({
        title: `Payment Collection Report - ${todayStr}`,
        text: shareText,
        dialogTitle: 'Share Collection Report',
      });

      toast({
        title: "Share Ready",
        description: "Collection report is ready to share via WhatsApp, SMS, or other apps.",
      });

    } catch (error) {
      console.error('Error sharing collection report:', error);
      toast({
        variant: "destructive",
        title: "Share Error",
        description: "Failed to share collection report. Please try again.",
      });
    }
  };

  const printCollectionPage = () => {
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          variant: "destructive",
          title: "Print Error",
          description: "Unable to open print window. Please check your browser settings.",
        });
        return;
      }

      const today = new Date();
      const todayStr = format(today, 'dd/MM/yyyy');
      const stats = getTodayCollectionStats();
      const collectedCustomers = getTodayCollectedCustomers();

      // Build HTML content for printing
      let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Collection Report - ${todayStr}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              color: #2563eb;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            @media (max-width: 768px) {
              .header {
                margin-top: 80px;
              }
            }
            .summary {
              margin-bottom: 30px;
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
            }
            .summary h2 {
              margin-top: 0;
              color: #2563eb;
              font-size: 18px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin-top: 15px;
            }
            .summary-item {
              background: white;
              padding: 15px;
              border-radius: 6px;
              border-left: 4px solid #2563eb;
            }
            .summary-item .label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              font-weight: bold;
            }
            .summary-item .value {
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-top: 5px;
            }
            .customers-section {
              margin-top: 30px;
            }
            .customers-section h2 {
              color: #2563eb;
              font-size: 18px;
              margin-bottom: 20px;
            }
            .customer-card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 20px;
              background: white;
            }
            .customer-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 15px;
            }
            .customer-name {
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            .customer-badge {
              background: #dcfce7;
              color: #166534;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
            }
            .customer-details {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 10px;
              margin-bottom: 15px;
              font-size: 14px;
              color: #666;
            }
            .payment-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #f0f9ff;
              padding: 15px;
              border-radius: 6px;
              margin-bottom: 15px;
            }
            .payment-amount {
              font-size: 16px;
              font-weight: bold;
              color: #059669;
            }
            .payment-details {
              font-size: 14px;
              color: #666;
            }
            .payments-list {
              margin-top: 15px;
            }
            .payment-item {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 6px;
              padding: 15px;
              margin-bottom: 10px;
            }
            .payment-item-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .payment-amount-large {
              font-size: 18px;
              font-weight: bold;
              color: #059669;
            }
            .payment-type {
              background: #e0e7ff;
              color: #3730a3;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .payment-notes {
              font-size: 14px;
              color: #666;
              margin-top: 5px;
            }
            .confirmed-badge {
              background: #dcfce7;
              color: #166534;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: bold;
            }
            .no-data {
              text-align: center;
              color: #666;
              font-style: italic;
              padding: 40px;
            }
            .action-buttons {
              position: fixed;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              display: flex;
              gap: 15px;
              z-index: 1000;
            }
            .action-button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              transition: all 0.2s ease;
              min-width: 100px;
            }
            .action-button:hover {
              background: #1d4ed8;
              transform: translateY(-2px);
            }
            .action-button:active {
              transform: translateY(0);
            }
            .action-button.close {
              background: #dc2626;
            }
            .action-button.close:hover {
              background: #b91c1c;
            }
            @media (max-width: 768px) {
              .action-buttons {
                bottom: 15px;
                gap: 12px;
              }
              .action-button {
                padding: 14px 20px;
                font-size: 16px;
                min-width: 110px;
              }
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .action-buttons { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Collection Report</h1>
            <p>Email: ${user?.email || 'N/A'}</p>
            <p>Date: ${todayStr}</p>
            <p>Generated on: ${format(today, 'dd/MM/yyyy HH:mm')}</p>
          </div>

          <div class="summary">
            <h2>Today's Collection Summary</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="label">Total Collected</div>
                <div class="value">₹${stats.totalCollected.toFixed(2)}</div>
              </div>
              <div class="summary-item">
                <div class="label">Customers Paid EMI</div>
                <div class="value">${stats.customersPaidEMI}</div>
              </div>
              <div class="summary-item">
                <div class="label">Scheduled for Collection</div>
                <div class="value">${stats.scheduledCount}</div>
              </div>
              <div class="summary-item">
                <div class="label">Paid Less than EMI</div>
                <div class="value">${stats.customersPaidLess}</div>
              </div>
              <div class="summary-item">
                <div class="label">Paid More than EMI</div>
                <div class="value">${stats.customersPaidMore}</div>
              </div>
              <div class="summary-item">
                <div class="label">Today's Loan Disbursement</div>
                <div class="value">₹${stats.todayDisbursement.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div class="customers-section">
            <h2>Collected Customers Details</h2>
      `;

      if (collectedCustomers.length === 0) {
        printContent += `
          <div class="no-data">
            No payments collected today.
          </div>
        `;
      } else {
        collectedCustomers.forEach((customer) => {
          const outstandingBalance = calculateCustomerOutstanding(customer);
          const emiAmount = calculateCustomerEMIAmount(customer);
          const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
          const today = new Date().toISOString().split('T')[0];
          
          // Get today's payments for this customer
          const todayPayments = activeLoans.flatMap(loan => 
            allTransactions.filter(t => 
              t.loan_id === loan.id && t.payment_date === today
            )
          );
          
          const totalTodayPayment = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);

          printContent += `
            <div class="customer-card">
              <div class="customer-header">
                <div class="customer-name">
                  ${customer.name}
                  ${customer.payment_day ? `(${dayLabels[customer.payment_day.toLowerCase() as keyof typeof dayLabels] || customer.payment_day})` : ''}
                </div>
                <div class="customer-badge">Collected Today</div>
              </div>
              
              <div class="customer-details">
                ${customer.phone ? `<div>📞 ${customer.phone}</div>` : ''}
                ${customer.address ? `<div>📍 ${customer.address}</div>` : ''}
                <div>👤 ${activeLoans.length} active loan${activeLoans.length !== 1 ? 's' : ''}</div>
              </div>
              
              <div class="payment-info">
                <div>
                  <div class="payment-amount">Collected Today: ₹${totalTodayPayment.toFixed(2)}</div>
                  <div class="payment-details">
                    Outstanding: ₹${outstandingBalance.toFixed(2)} | EMI: ₹${emiAmount.toFixed(2)}
                  </div>
                </div>
              </div>
          `;

          if (todayPayments.length > 0) {
            printContent += `
              <div class="payments-list">
                <h4>Today's Payments:</h4>
            `;

            todayPayments.forEach((payment) => {
              const isConfirmed = confirmedTransactions[payment.id];
              printContent += `
                <div class="payment-item">
                  <div class="payment-item-header">
                    <div class="payment-amount-large">₹${payment.amount.toFixed(2)}</div>
                    <div>
                      <span class="payment-type">${payment.transaction_type} - ${payment.payment_mode}</span>
                      ${isConfirmed ? '<span class="confirmed-badge">Confirmed</span>' : ''}
                    </div>
                  </div>
                  ${payment.notes ? `<div class="payment-notes">${payment.notes}</div>` : ''}
                </div>
              `;
            });

            printContent += `</div>`;
          }

          printContent += `</div>`;
        });
      }

      printContent += `
          </div>
          
          <div class="action-buttons no-print">
            <button class="action-button" onclick="window.print()">🖨️ Print</button>
            <button class="action-button close" onclick="closePrintWindow()">❌ Close</button>
          </div>
          
          <script>
            function closePrintWindow() {
              try {
                // Try to close the window
                window.close();
                
                // If window.close() doesn't work (mobile browsers), try alternatives
                setTimeout(() => {
                  if (!window.closed) {
                    // Try to navigate back or show message
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      // Show message for user to manually close
                      alert('Please close this tab/window manually to return to the collection page.');
                    }
                  }
                }, 100);
              } catch (error) {
                // Fallback: show message
                alert('Please close this tab/window manually to return to the collection page.');
              }
            }
          </script>
        </body>
        </html>
      `;

      // Write content to print window
      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load
      printWindow.onload = () => {
        setTimeout(() => {
          // Don't auto-print, let user choose when to print
          
          // Add event listener for better mobile support
          printWindow.addEventListener('beforeunload', () => {
            // Window is being closed
          });
        }, 250);
      };

      toast({
        title: "Print Page Ready",
        description: "Print page opened. Use the buttons at the bottom to print or close. On mobile, you may need to manually close the tab.",
      });

    } catch (error) {
      console.error('Error printing collection page:', error);
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Failed to generate print view. Please try again.",
      });
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF('landscape');
      const todayDate = new Date();
      const today = todayDate.toISOString().split('T')[0]; // String format for database comparison
      const todayStr = format(todayDate, 'dd/MM/yyyy');
      
      // Set font
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Payment Collection Report', 20, 20);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(`Date: ${todayStr}`, 20, 30);
      
      // Add summary statistics
      const stats = getTodayCollectionStats();
      let yPosition = 45;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Today\'s Collection Summary', 20, yPosition);
      yPosition += 10;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      // Summary table
      const summaryData = [
        ['Metric', 'Value'],
        ['Total Collected', stats.totalCollected.toFixed(2)],
        ['Customers Paid EMI', stats.customersPaidEMI.toString()],
        ['Scheduled for Collection', stats.scheduledCount.toString()],
        ['Paid Less than EMI', stats.customersPaidLess.toString()],
        ['Paid More than EMI', stats.customersPaidMore.toString()],
        ['Pending Collection for Today', `${stats.pendingCollectionAmount.toFixed(2)} (${stats.pendingCustomersCount})`],
        ['Today\'s Loan Disbursement', stats.todayDisbursement.toFixed(2)]
      ];
      
      // Draw table
      const tableTop = yPosition;
      const cellHeight = 8;
      const cellWidth = 80;
      
      summaryData.forEach((row, rowIndex) => {
        const y = tableTop + (rowIndex * cellHeight);
        
        // Header row
        if (rowIndex === 0) {
          doc.setFillColor(240, 240, 240);
          doc.rect(20, y, cellWidth, cellHeight, 'F');
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        
        // Draw cell borders
        doc.rect(20, y, cellWidth, cellHeight);
        doc.rect(100, y, cellWidth, cellHeight);
        
        // Add text
        doc.text(row[0], 22, y + 5);
        doc.text(row[1], 102, y + 5);
      });
      
      yPosition = tableTop + (summaryData.length * cellHeight) + 15;
      
      // Add collected customers details table
      const collectedCustomers = getTodayCollectedCustomers();
      if (collectedCustomers.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Collected Customers Details', 20, yPosition);
        yPosition += 15;
        
        // Table headers
        const headers = [
          'Customer Name',
          'Mobile No',
          'Date of Loan',
          'Loan Amount',
          'EMI Amount',
          'Running Week',
          'EMIs Paid',
          'EMI Scheduled',
          'Total EMI Paid',
          'Today\'s Collected',
          'Outstanding',
          'Status'
        ];
        
        // Column widths (adjusted for landscape A4 page - more width available)
        const colWidths = [30, 22, 22, 22, 20, 16, 14, 20, 20, 20, 20, 16];
        const tableStartX = 20;
        
        // Calculate available space and adjust row height (landscape has more width, less height)
        const availableHeight = 180 - yPosition; // Available space from current position to bottom (landscape)
        const totalRows = collectedCustomers.length + 1; // +1 for header
        const minRowHeight = 6; // Minimum row height
        const maxRowHeight = 12; // Maximum row height
        const calculatedRowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, availableHeight / totalRows));
        const rowHeight = calculatedRowHeight;
        
        // Draw table headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        let currentX = tableStartX;
        
        headers.forEach((header, index) => {
          doc.setFillColor(240, 240, 240);
          doc.rect(currentX, yPosition, colWidths[index], rowHeight, 'F');
          doc.rect(currentX, yPosition, colWidths[index], rowHeight);
          
          // Wrap text and center in cell
          const maxWidth = colWidths[index] - 4; // Leave some padding
          const wrappedText = wrapText(doc, header, maxWidth, 8);
          
          // Calculate starting Y position to center the wrapped text
          const textHeight = wrappedText.length * 3; // Approximate line height
          const startY = yPosition + (rowHeight - textHeight) / 2 + 2;
          
          // Draw each line of wrapped text
          wrappedText.forEach((line: string, lineIndex: number) => {
            const textWidth = doc.getTextWidth(line);
            const textX = currentX + (colWidths[index] - textWidth) / 2;
            doc.text(line, textX, startY + (lineIndex * 3));
          });
          
          currentX += colWidths[index];
        });
        
        yPosition += rowHeight;
        
        // Draw table data
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        
        let currentRowHeight = rowHeight;
        
        collectedCustomers.forEach((customer, index) => {
          // Check if we need a new page (landscape height is smaller)
          if (yPosition + currentRowHeight > 180) {
            doc.addPage('landscape');
            yPosition = 20;
            
            // Recalculate row height for new page
            const newAvailableHeight = 180 - yPosition;
            const remainingRows = collectedCustomers.length - index;
            currentRowHeight = Math.max(minRowHeight, Math.min(maxRowHeight, newAvailableHeight / (remainingRows + 1)));
            
            // Redraw headers on new page
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            currentX = tableStartX;
            
            headers.forEach((header, headerIndex) => {
              doc.setFillColor(240, 240, 240);
              doc.rect(currentX, yPosition, colWidths[headerIndex], currentRowHeight, 'F');
              doc.rect(currentX, yPosition, colWidths[headerIndex], currentRowHeight);
              
              // Wrap text and center in cell
              const maxWidth = colWidths[headerIndex] - 4; // Leave some padding
              const wrappedText = wrapText(doc, header, maxWidth, 8);
              
              // Calculate starting Y position to center the wrapped text
              const textHeight = wrappedText.length * 3; // Approximate line height
              const startY = yPosition + (currentRowHeight - textHeight) / 2 + 2;
              
              // Draw each line of wrapped text
              wrappedText.forEach((line: string, lineIndex: number) => {
                const textWidth = doc.getTextWidth(line);
                const textX = currentX + (colWidths[headerIndex] - textWidth) / 2;
                doc.text(line, textX, startY + (lineIndex * 3));
              });
              
              currentX += colWidths[headerIndex];
            });
            
            yPosition += currentRowHeight;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
          }
          
          // Get customer loan data
          const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
          const customerLoan = activeLoans[0]; // Assuming one active loan per customer for now
          const outstandingBalance = calculateCustomerOutstanding(customer);
          const totalEMIPaidAmount = calculateCustomerTotalEMIPaid(customer);
          const emiAmount = calculateCustomerEMIAmount(customer);
          const loanDate = customerLoan?.loan_date ? new Date(customerLoan.loan_date) : new Date();
          const runningWeeks = Math.floor((todayDate.getTime() - loanDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
          const emisScheduled = emiAmount * runningWeeks;
          const status = outstandingBalance <= 0 ? 'Closed' : 'Active';
          
          // Calculate today's collected amount for this customer
          const todayCollectedAmount = activeLoans.reduce((sum, loan) => {
            const todayPayments = allTransactions.filter(t => 
              t.loan_id === loan.id && t.payment_date === today
            );
            return sum + todayPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
          }, 0);
          
          // Table row data
          const customerNameWithSchedule = customer.payment_day 
            ? `${customer.name} (${customer.payment_day})`
            : customer.name;
          const rowData = [
            customerNameWithSchedule.length > 20 ? customerNameWithSchedule.substring(0, 17) + '...' : customerNameWithSchedule,
            customer.phone || 'N/A',
            format(loanDate, 'dd/MM/yy'),
            (customerLoan?.principal_amount || 0).toFixed(0),
            emiAmount.toFixed(0),
            runningWeeks.toString(),
            calculateCustomerEMIsPaid(customer).toString(),
            emisScheduled.toString(),
            totalEMIPaidAmount.toFixed(0),
            todayCollectedAmount.toFixed(0),
            outstandingBalance.toFixed(0),
            status
          ];
          
          currentX = tableStartX;
          
          rowData.forEach((data, dataIndex) => {
            doc.rect(currentX, yPosition, colWidths[dataIndex], currentRowHeight);
            
            // Center text in cell
            const textWidth = doc.getTextWidth(data);
            const textX = currentX + (colWidths[dataIndex] - textWidth) / 2;
            doc.text(data, textX, yPosition + currentRowHeight/2 + 2);
            
            currentX += colWidths[dataIndex];
          });
          
          yPosition += currentRowHeight;
        });
        
        // Add total row
        if (collectedCustomers.length > 0) {
          // Check if we need a new page for the total row
          if (yPosition + currentRowHeight > 180) {
            doc.addPage('landscape');
            yPosition = 20;
            currentRowHeight = minRowHeight;
          }
          
          // Calculate totals
          const totalLoanAmount = collectedCustomers.reduce((sum, customer) => {
            const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
            const customerLoan = activeLoans[0];
            return sum + (customerLoan?.principal_amount || 0);
          }, 0);
          
          const totalEMIAmount = collectedCustomers.reduce((sum, customer) => {
            return sum + calculateCustomerEMIAmount(customer);
          }, 0);
          
          const totalEMIPaid = collectedCustomers.reduce((sum, customer) => {
            return sum + calculateCustomerTotalEMIPaid(customer);
          }, 0);
          
          const totalOutstanding = collectedCustomers.reduce((sum, customer) => {
            return sum + calculateCustomerOutstanding(customer);
          }, 0);
          
          const totalTodayCollected = collectedCustomers.reduce((sum, customer) => {
            const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
            return sum + activeLoans.reduce((loanSum, loan) => {
              const todayPayments = allTransactions.filter(t => 
                t.loan_id === loan.id && t.payment_date === today
              );
              return loanSum + todayPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
            }, 0);
          }, 0);
          
          // Total row data
          const totalRowData = [
            'TOTAL',
            '',
            '',
            totalLoanAmount.toFixed(0),
            totalEMIAmount.toFixed(0),
            '',
            '',
            '',
            totalEMIPaid.toFixed(0),
            totalTodayCollected.toFixed(0),
            totalOutstanding.toFixed(0),
            ''
          ];
          
          // Draw total row with different styling
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          currentX = tableStartX;
          
          totalRowData.forEach((data, dataIndex) => {
            doc.setFillColor(220, 220, 220); // Light gray background
            doc.rect(currentX, yPosition, colWidths[dataIndex], currentRowHeight, 'F');
            doc.rect(currentX, yPosition, colWidths[dataIndex], currentRowHeight);
            
            if (data) {
              const textWidth = doc.getTextWidth(data);
              const textX = currentX + (colWidths[dataIndex] - textWidth) / 2;
              doc.text(data, textX, yPosition + currentRowHeight/2 + 2);
            }
            
            currentX += colWidths[dataIndex];
          });
          
          yPosition += currentRowHeight;
        }
      }
      
      // Add footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Generated on: ${format(today, 'dd/MM/yyyy HH:mm')}`, 20, 200);
        doc.text(`Page ${i} of ${pageCount}`, 250, 200);
      }
      
      // Save PDF
      const pdfName = `collection-report-${format(today, 'dd-MM-yyyy')}.pdf`;
      doc.save(pdfName);
      
      toast({
        title: "PDF Generated",
        description: "Collection report has been downloaded as PDF.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF report",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="space-y-4">
        {/* Mobile: Buttons first, then title */}
        <div className="flex flex-col sm:hidden space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={shareCollectionReport}
              disabled={!areAllTransactionsConfirmed()}
              title={!areAllTransactionsConfirmed() ? "Please confirm all collected transactions before sharing" : "Share Collection Report via WhatsApp, SMS, etc."}
              className="flex-shrink-0"
            >
              <ShareIcon className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button 
              variant="outline" 
              onClick={printCollectionPage}
              disabled={!areAllTransactionsConfirmed()}
              title={!areAllTransactionsConfirmed() ? "Please confirm all collected transactions before printing" : "Print Collection Report"}
              className="flex-shrink-0"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button 
              variant="outline" 
              onClick={generatePDF}
              disabled={!areAllTransactionsConfirmed()}
              title={!areAllTransactionsConfirmed() ? "Please confirm all collected transactions before downloading PDF" : "Download Payment Collection Report"}
              className="flex-shrink-0"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)} className="flex-shrink-0">
              Back
            </Button>
          </div>
          {!areAllTransactionsConfirmed() && getTodayCollectedCustomers().length > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              ⚠️ Confirm all collected transactions to enable Print, Share, and PDF download
            </p>
          )}
        </div>

        {/* Title section */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 flex-shrink-0" />
              <span className="truncate">Payment Collection</span>
            </h1>
            {(selectedDay || dayFromUrl) && (
              <p className="text-muted-foreground mt-1 truncate">
                Collecting payments for {dayLabels[(selectedDay || dayFromUrl) as keyof typeof dayLabels]}
              </p>
            )}
          </div>
          
          {/* Desktop: Buttons on the right */}
          <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={shareCollectionReport}
                disabled={!areAllTransactionsConfirmed()}
                title={!areAllTransactionsConfirmed() ? "Please confirm all collected transactions before sharing" : "Share Collection Report via WhatsApp, SMS, etc."}
                className="flex-shrink-0"
              >
                <ShareIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Share</span>
                <span className="sm:hidden">Share</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={printCollectionPage}
                disabled={!areAllTransactionsConfirmed()}
                title={!areAllTransactionsConfirmed() ? "Please confirm all collected transactions before printing" : "Print Collection Report"}
                className="flex-shrink-0"
              >
                <Printer className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Print</span>
                <span className="sm:hidden">Print</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={generatePDF}
                disabled={!areAllTransactionsConfirmed()}
                title={!areAllTransactionsConfirmed() ? "Please confirm all collected transactions before downloading PDF" : "Download Payment Collection Report"}
                className="flex-shrink-0"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Download PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)} className="flex-shrink-0">
                Back
              </Button>
            </div>
            {!areAllTransactionsConfirmed() && getTodayCollectedCustomers().length > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded text-right">
                ⚠️ Confirm all collected transactions to enable Print, Share, and PDF download
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers by name, phone, address, or payment day..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scheduled">Scheduled Collection ({getScheduledCustomers().length})</TabsTrigger>
          <TabsTrigger value="collected">Collected ({getTodayCollectedCustomers().length})</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4">
          {/* Scheduled Customer List */}
          <div className="grid gap-4">
            {getScheduledCustomers().length > 0 ? (
              getScheduledCustomers().map((customer) => {
                const outstandingBalance = calculateCustomerOutstanding(customer);
                const emiAmount = calculateCustomerEMIAmount(customer);
                const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
                const customerPaymentData = getCustomerPaymentData(customer.id);
                
                return (
                  <Card key={customer.id} className="hover:shadow-md transition-shadow overflow-hidden">
                    <CardContent className="p-4 overflow-hidden">
                      <div className="space-y-4">
                        {/* Customer Info */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg truncate">
                                {customer.name}
                                {customer.payment_day && (
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    ({dayLabels[customer.payment_day.toLowerCase() as keyof typeof dayLabels] || customer.payment_day})
                                  </span>
                                )}
                              </h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                              {customer.phone && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <Phone className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{customer.phone}</span>
                                </div>
                              )}
                              {customer.address && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <MapPin className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{customer.address}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 flex-shrink-0" />
                                <span>{activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right space-y-2 min-w-0 flex-shrink-0">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-green-600 truncate">
                                Outstanding: {formatCurrency(outstandingBalance)}
                              </p>
                              <p className="text-sm font-semibold text-purple-700 truncate bg-purple-50 px-2 py-1 rounded">
                                EMI: {formatCurrency(emiAmount)}
                              </p>
                            </div>
                            
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedCustomer(customer)}
                                className="flex-shrink-0"
                                title="View customer details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => togglePaymentForm(customer.id)}
                                className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                <span className="hidden sm:inline">
                                  {showPaymentForm[customer.id] ? 'Hide Form' : 'Collect Payment'}
                                </span>
                                <span className="sm:hidden">
                                  {showPaymentForm[customer.id] ? 'Hide' : 'Collect'}
                                </span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Payment Form */}
                        {showPaymentForm[customer.id] && (
                          <div className="border-t pt-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <Label htmlFor={`amount-${customer.id}`}>Amount (₹)</Label>
                                <Input
                                  id={`amount-${customer.id}`}
                                  type="number"
                                  step="0.01"
                                  placeholder="Enter amount"
                                  value={customerPaymentData.amount}
                                  onChange={(e) => updatePaymentData(customer.id, 'amount', e.target.value, outstandingBalance)}
                                  className={paymentErrors[customer.id] ? 'border-red-500' : ''}
                                />
                                {paymentErrors[customer.id] && (
                                  <p className="text-sm text-red-500 mt-1">{paymentErrors[customer.id]}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor={`type-${customer.id}`}>Payment Type</Label>
                                <Select
                                  value={customerPaymentData.transaction_type}
                                  onValueChange={(value: 'principal' | 'interest' | 'mixed') => 
                                    updatePaymentData(customer.id, 'transaction_type', value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="principal">Principal</SelectItem>
                                    <SelectItem value="interest">Interest</SelectItem>
                                    <SelectItem value="mixed">Mixed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`mode-${customer.id}`}>Payment Mode</Label>
                                <Select
                                  value={customerPaymentData.payment_mode}
                                  onValueChange={(value: 'cash' | 'bank') => 
                                    updatePaymentData(customer.id, 'payment_mode', value)
                                  }
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
                                <Label htmlFor={`notes-${customer.id}`}>Notes (Optional)</Label>
                                <Input
                                  id={`notes-${customer.id}`}
                                  placeholder="Add notes..."
                                  value={customerPaymentData.notes}
                                  onChange={(e) => updatePaymentData(customer.id, 'notes', e.target.value)}
                                />
                              </div>
                            </div>
                            
                            <Button 
                              onClick={() => handlePayment(customer)}
                              className="w-full"
                              disabled={!customerPaymentData.amount || !!paymentErrors[customer.id]}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Submit Payment
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No customers found matching your search.' : 'No customers scheduled for collection.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="collected" className="space-y-4">
          {/* Today's Collection Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Today's Collection Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const stats = getTodayCollectionStats();
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(stats.totalCollected)}
                      </div>
                      <div className="text-sm text-green-600 font-medium">Today's Collected</div>
                    </div>
                    
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-2xl font-bold text-blue-700">
                        {stats.customersPaidEMI}
                      </div>
                      <div className="text-sm text-blue-600 font-medium">Customers Paid EMI</div>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-2xl font-bold text-purple-700">
                        {stats.scheduledCount}
                      </div>
                      <div className="text-sm text-purple-600 font-medium">Scheduled for Collection</div>
                    </div>
                    
                    <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="text-2xl font-bold text-orange-700">
                        {stats.customersPaidLess}
                      </div>
                      <div className="text-sm text-orange-600 font-medium">Paid Less than EMI</div>
                    </div>
                    
                    <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-700">
                        {stats.customersPaidMore}
                      </div>
                      <div className="text-sm text-yellow-600 font-medium">Paid More than EMI</div>
                    </div>
                    
                    <div className="text-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <div className="text-2xl font-bold text-indigo-700">
                        {formatCurrency(stats.todayDisbursement)}
                      </div>
                      <div className="text-sm text-indigo-600 font-medium">Today's Loan Disbursement</div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Collected Customer List */}
          <div className="grid gap-4">
            {getTodayCollectedCustomers().length > 0 ? (
              getTodayCollectedCustomers().map((customer) => {
                const outstandingBalance = calculateCustomerOutstanding(customer);
                const emiAmount = calculateCustomerEMIAmount(customer);
                const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
                const today = new Date().toISOString().split('T')[0];
                
                // Get today's payments for this customer
                const todayPayments = activeLoans.flatMap(loan => 
                  allTransactions.filter(t => 
                    t.loan_id === loan.id && t.payment_date === today
                  )
                );
                
                const totalTodayPayment = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
                
                return (
                  <Card key={customer.id} className="hover:shadow-md transition-shadow border-green-200 overflow-hidden">
                    <CardContent className="p-4 overflow-hidden">
                      <div className="space-y-4">
                        {/* Customer Info */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-semibold text-lg truncate">
                                {customer.name}
                                {customer.payment_day && (
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    ({dayLabels[customer.payment_day.toLowerCase() as keyof typeof dayLabels] || customer.payment_day})
                                  </span>
                                )}
                              </h3>
                              <Badge variant="outline" className="bg-green-100 text-green-800 flex-shrink-0">
                                Collected Today
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                              {customer.phone && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <Phone className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{customer.phone}</span>
                                </div>
                              )}
                              {customer.address && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <MapPin className="h-4 w-4 flex-shrink-0" />
                                  <span className="truncate">{customer.address}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 flex-shrink-0" />
                                <span>{activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right space-y-2 min-w-0 flex-shrink-0">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-green-600 truncate">
                                Collected Today: {formatCurrency(totalTodayPayment)}
                              </p>
                              <p className="text-sm font-medium text-blue-600 truncate">
                                Outstanding: {formatCurrency(outstandingBalance)}
                              </p>
                              {emiAmount > 0 && (
                                <p className="text-sm font-medium text-purple-600 truncate">
                                  EMI: {formatCurrency(emiAmount)}
                                </p>
                              )}
                            </div>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedCustomer(customer)}
                              className="flex-shrink-0"
                              title="View customer details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Today's Payment Details */}
                        {todayPayments.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-medium mb-2">Today's Payments:</h4>
                            <div className="space-y-2">
                              {todayPayments.map((payment, index) => {
                                const isEditing = editingPayments[customer.id]?.[payment.id];
                                const editedPayment = isEditing ? editingPayments[customer.id][payment.id] : null;
                                
                                return (
                                  <div key={index} className="p-3 bg-green-50 rounded border">
                                    {isEditing ? (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-1 gap-2">
                                          <div>
                                            <Label htmlFor={`edit-amount-${payment.id}`} className="text-xs">Amount (will auto-split: interest first, then principal)</Label>
                                            <Input
                                              id={`edit-amount-${payment.id}`}
                                              type="number"
                                              step="0.01"
                                              value={editedPayment.amount}
                                              onChange={(e) => updateEditingPayment(customer.id, payment.id, 'amount', e.target.value)}
                                              className="h-8"
                                            />
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <Label htmlFor={`edit-mode-${payment.id}`} className="text-xs">Payment Mode</Label>
                                            <Select
                                              value={editedPayment.payment_mode}
                                              onValueChange={(value: 'cash' | 'bank') => 
                                                updateEditingPayment(customer.id, payment.id, 'payment_mode', value)
                                              }
                                            >
                                              <SelectTrigger className="h-8">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="bank">Bank</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <Label htmlFor={`edit-notes-${payment.id}`} className="text-xs">Notes</Label>
                                            <Input
                                              id={`edit-notes-${payment.id}`}
                                              value={editedPayment.notes}
                                              onChange={(e) => updateEditingPayment(customer.id, payment.id, 'notes', e.target.value)}
                                              className="h-8"
                                              placeholder="Add notes..."
                                            />
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => saveEditedPayment(customer.id, payment.id)}
                                            className="h-8"
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => cancelEditingPayment(customer.id, payment.id)}
                                            className="h-8"
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                          <div>
                                            <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                            <span className="text-sm text-muted-foreground ml-2">
                                              ({payment.transaction_type} - {payment.payment_mode})
                                            </span>
                                            {payment.notes && (
                                              <div className="text-sm text-muted-foreground mt-1">{payment.notes}</div>
                                            )}
                                          </div>
                                          {confirmedTransactions[payment.id] && (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                                              Confirmed
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`confirm-${payment.id}`}
                                              checked={confirmedTransactions[payment.id] || false}
                                              onCheckedChange={(checked) => 
                                                handleConfirmTransaction(customer.id, payment.id, checked as boolean)
                                              }
                                              disabled={confirmedTransactions[payment.id]}
                                            />
                                            <Label 
                                              htmlFor={`confirm-${payment.id}`} 
                                              className="text-xs text-muted-foreground cursor-pointer"
                                            >
                                              Confirm
                                            </Label>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEditingPayment(customer.id, payment)}
                                            className="h-8"
                                            disabled={confirmedTransactions[payment.id]}
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No payments collected today.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default CollectionPage;
