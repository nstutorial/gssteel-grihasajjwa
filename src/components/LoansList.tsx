import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, DollarSign, Calendar, Plus, Eye, Edit, Trash2, FileText, Download, Lock } from 'lucide-react';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import { useControl } from '@/contexts/ControlContext';
import EditLoanDialog from './EditLoanDialog';
import AddLoanDialog from './AddLoanDialog';

interface Loan {
  id: string;
  loan_number: string;
  principal_amount: number;
  processing_fee?: number;
  total_outstanding?: number;
  interest_rate: number;
  interest_type: 'daily' | 'monthly' | 'none';
  emi_amount?: number;
  loan_date: string;
  due_date?: string;
  description?: string;
  is_active: boolean;
  customer_id: string;
  locked?: boolean;
  customers: {
    name: string;
    phone?: string;
  };
}

interface LoanTransaction {
  id: string;
  loan_id: string;
  amount: number;
  transaction_type: 'principal' | 'interest' | 'mixed';
  payment_mode: 'cash' | 'bank';
  payment_date: string;
  notes?: string;
}

interface LoansListProps {
  onUpdate: () => void;
  status?: 'active' | 'closed';
}

const LoansList: React.FC<LoansListProps> = ({ onUpdate, status = 'active' }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addLoanDialogOpen, setAddLoanDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [paymentData, setPaymentData] = useState({
    amount: '',
    type: 'mixed' as 'principal' | 'interest' | 'mixed',
    notes: '',
    payment_mode: 'cash' as 'cash' | 'bank',
  });

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchLoans();
    };

    window.addEventListener('refresh-loans', handleRefresh);
    return () => window.removeEventListener('refresh-loans', handleRefresh);
  }, []);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          id,
          loan_number,
          principal_amount,
          processing_fee,
          total_outstanding,
          interest_rate,
          interest_type,
          emi_amount,
          loan_date,
          due_date,
          description,
          is_active,
          customers (name, phone)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch loans",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (loanId: string) => {
    try {
      const { data, error } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setTransactions((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch transactions",
      });
    }
  };

  const calculateLoanBalance = (loanId: string) => {
    const loanTransactions = transactions.filter(t => t.loan_id === loanId);
    const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
    const loan = loans.find(l => l.id === loanId);
    return loan ? loan.principal_amount - totalPaid : 0;
  };

  const calculateInterest = (loan: Loan, balance: number): number => {
    if (loan.interest_type === 'none' || loan.interest_rate === 0) return 0;

    const loanDate = new Date(loan.loan_date);
    const currentDate = new Date();
    const rate = loan.interest_rate / 100;

    if (loan.interest_type === 'daily') {
      // Daily interest calculation
      const timeDiff = currentDate.getTime() - loanDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      // Monthly interest calculation
      const months = (currentDate.getFullYear() - loanDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - loanDate.getMonth());
      const daysInMonth = (currentDate.getDate() - loanDate.getDate()) / 30; // Approximate partial month
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }

    return 0;
  };

  const calculateOutstandingAmount = (loan: Loan) => {
    const balance = calculateLoanBalance(loan.id);
    const interest = calculateInterest(loan, balance);
    return balance + interest;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    try {
      const paymentAmount = parseFloat(paymentData.amount);
      
      // Calculate current outstanding interest and principal
      const currentBalance = calculateLoanBalance(selectedLoan.id);
      const currentInterest = calculateInterest(selectedLoan, currentBalance);
      
      // Split payment: interest first, then principal
      let interestPayment = 0;
      let principalPayment = 0;
      
      if (currentInterest > 0 && paymentAmount > 0) {
        // Pay interest first
        interestPayment = Math.min(paymentAmount, currentInterest);
        // Remaining amount goes to principal
        principalPayment = paymentAmount - interestPayment;
      } else {
        // No interest, all goes to principal
        principalPayment = paymentAmount;
      }
      
      // Create transaction records
      const transactions = [];
      
      if (interestPayment > 0) {
        transactions.push({
          loan_id: selectedLoan.id,
          amount: interestPayment,
          transaction_type: 'interest',
          payment_mode: paymentData.payment_mode,
          notes: paymentData.notes ? `${paymentData.notes} (Interest portion)` : 'Interest portion',
        });
      }
      
      if (principalPayment > 0) {
        transactions.push({
          loan_id: selectedLoan.id,
          amount: principalPayment,
          transaction_type: 'principal',
          payment_mode: paymentData.payment_mode,
          notes: paymentData.notes ? `${paymentData.notes} (Principal portion)` : 'Principal portion',
        });
      }
      
      // Insert all transactions
      const { error } = await supabase
        .from('loan_transactions')
        .insert(transactions);

      if (error) throw error;

      toast({
        title: "Payment recorded",
        description: `₹${paymentAmount.toFixed(2)} recorded (Interest: ₹${interestPayment.toFixed(2)}, Principal: ₹${principalPayment.toFixed(2)})`,
      });

      setPaymentData({ amount: '', type: 'mixed', notes: '', payment_mode: 'cash' });
      setShowPaymentDialog(false);
      await fetchLoans();
      await fetchTransactions(selectedLoan.id);
      onUpdate();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record payment",
      });
    }
  };

  const showLedger = async (loan: Loan) => {
    setSelectedLoan(loan);
    await fetchTransactions(loan.id);
    setShowLedgerDialog(true);
  };

  const showPayment = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowPaymentDialog(true);
  };

  const handleEditLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setEditDialogOpen(true);
  };

  const generateLoanStatement = async (loan: Loan) => {
    try {
      // Fetch all transactions for this loan
      const { data: loanTransactions, error: transactionsError } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loan.id)
        .order('payment_date', { ascending: true });

      if (transactionsError) throw transactionsError;

      // Calculate loan details
      const balance = calculateLoanBalance(loan.id);
      const interest = calculateInterest(loan, balance);
      const totalInterestPaid = loanTransactions?.filter(t => t.transaction_type === 'interest').reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalPrincipalPaid = loanTransactions?.filter(t => t.transaction_type === 'principal').reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalPaid = totalInterestPaid + totalPrincipalPaid;

      // Generate statement content
      const statementContent = `
LOAN STATEMENT
==============

Client: ${loan.customers.name}
Phone: ${loan.customers.phone || 'N/A'}
Loan Number: ${loan.loan_number}
Loan Date: ${new Date(loan.loan_date).toLocaleDateString()}
${loan.due_date ? `Due Date: ${new Date(loan.due_date).toLocaleDateString()}` : ''}
Interest Rate: ${loan.interest_type === 'none' ? 'No Interest' : `${loan.interest_rate}% ${loan.interest_type}`}

LOAN DETAILS
============
Principal Amount: ${loan.principal_amount.toFixed(2)}
Total Interest Charged: ${interest.toFixed(2)}
Total Loan Amount: ${(loan.principal_amount + interest).toFixed(2)}

PAYMENT SUMMARY
===============
Total Principal Paid: ${totalPrincipalPaid.toFixed(2)}
Total Interest Paid: ${totalInterestPaid.toFixed(2)}
Total Amount Paid: ${totalPaid.toFixed(2)}
Outstanding Balance: ${balance.toFixed(2)}

PAYMENT HISTORY
===============
${loanTransactions?.map(transaction => {
  const date = new Date(transaction.payment_date).toLocaleDateString();
  const type = transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1);
  return `${date} - ${type}: ${transaction.amount.toFixed(2)}${transaction.notes ? ` (${transaction.notes})` : ''}`;
}).join('\n') || 'No payments recorded.'}

STATUS: ${balance <= 0 ? 'CLOSED' : 'ACTIVE'}
Generated on: ${new Date().toLocaleDateString()}
      `.trim();

      // Create and download the file
      const blob = new Blob([statementContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loan-statement-${loan.loan_number}-${loan.customers.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Statement Generated',
        description: `Loan statement for ${loan.customers.name} has been downloaded.`,
      });

    } catch (error) {
      console.error('Error generating loan statement:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate loan statement",
      });
    }
  };



  const downloadPDF = (blob: Blob, filename: string) => {
    saveAs(blob, filename);
  };
  
  const formatNumber = (value: number) => {
    return value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  
  const generatePDFStatement = async (loan: Loan) => {
    try {
      // Fetch all transactions for this loan
      const { data: loanTransactions, error: transactionsError } = await supabase
        .from("loan_transactions")
        .select("*")
        .eq("loan_id", loan.id)
        .order("payment_date", { ascending: true });
  
      if (transactionsError) throw transactionsError;
  
      // Calculate loan details
      const balance = calculateLoanBalance(loan.id);
      const interest = calculateInterest(loan, balance);
      const totalInterestPaid =
        loanTransactions?.filter((t) => t.transaction_type === "interest")
          .reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalPrincipalPaid =
        loanTransactions?.filter((t) => t.transaction_type === "principal")
          .reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalPaid = totalInterestPaid + totalPrincipalPaid;
  
      // Create new PDF document
      const doc = new jsPDF();
  
      // Title
      doc.setFontSize(18);
      doc.setFont("courier", "bold");
      doc.text("LOAN STATEMENT", 105, 20, { align: "center" });
  
      // Line separator
      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);
  
      let yPosition = 35;
  
      // Client Info
      doc.setFontSize(12);
      doc.setFont("courier", "bold");
      doc.text("Client Information", 20, yPosition);
      yPosition += 8;
  
      doc.setFont("courier", "normal");
      doc.text(`Client: ${loan.customers.name}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Phone: ${loan.customers.phone || "N/A"}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Loan Number: ${loan.loan_number}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Loan Date: ${format(new Date(loan.loan_date), "dd/MM/yyyy")}`, 20, yPosition);
      yPosition += 6;
      if (loan.due_date) {
        doc.text(`Due Date: ${format(new Date(loan.due_date), "dd/MM/yyyy")}`, 20, yPosition);
        yPosition += 6;
      }
      doc.text(
        `Interest Rate: ${
          loan.interest_type === "none" ? "No Interest" : `${loan.interest_rate}% ${loan.interest_type}`
        }`,
        20,
        yPosition
      );
      yPosition += 15;
  
      // Loan Details
      doc.setFont("courier", "bold");
      doc.text("Loan Details", 20, yPosition);
      yPosition += 8;
  
      doc.setFont("courier", "normal");
      doc.text(`Principal Amount: ${formatNumber(loan.principal_amount)}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Interest Charged: ${formatNumber(interest)}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Loan Amount: ${formatNumber(loan.principal_amount + interest)}`, 20, yPosition);
      yPosition += 15;
  
      // Payment Summary
      doc.setFont("courier", "bold");
      doc.text("Payment Summary", 20, yPosition);
      yPosition += 8;
  
      doc.setFont("courier", "normal");
      doc.text(`Total Principal Paid: ${formatNumber(totalPrincipalPaid)}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Interest Paid: ${formatNumber(totalInterestPaid)}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Amount Paid: ${formatNumber(totalPaid)}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Outstanding Balance: ${formatNumber(balance)}`, 20, yPosition);
      yPosition += 15;
  
      // Payment History
      doc.setFont("courier", "bold");
      doc.text("Payment History", 20, yPosition);
      yPosition += 8;
  
      if (loanTransactions && loanTransactions.length > 0) {
        doc.setFont("courier", "normal");
        loanTransactions.forEach((transaction) => {
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
          const date = format(new Date(transaction.payment_date), "dd/MM/yyyy");
          const type =
            transaction.transaction_type.charAt(0).toUpperCase() +
            transaction.transaction_type.slice(1);
          const line = `${date} - ${type}: ${formatNumber(transaction.amount)}${
            transaction.notes ? ` (${transaction.notes})` : ""
          }`;
          doc.text(line, 20, yPosition);
          yPosition += 6;
        });
      } else {
        doc.setFont("courier", "normal");
        doc.text("No payments recorded.", 20, yPosition);
        yPosition += 6;
      }
  
      yPosition += 10;
  
      // Status
      doc.setFont("courier", "bold");
      doc.text(`STATUS: ${balance <= 0 ? "CLOSED" : "ACTIVE"}`, 20, yPosition);
      yPosition += 10;
  
      // Generated date
      doc.setFont("courier", "normal");
      doc.setFontSize(10);
      doc.text(`Generated on: ${format(new Date(), "dd/MM/yyyy")}`, 20, yPosition);
  
      // Save PDF
      const pdfName = `loan-statement-${loan.loan_number}-${loan.customers.name
        .replace(/\s+/g, "-")
        .toLowerCase()}.pdf`;
      const pdfBlob = doc.output("blob");
      downloadPDF(pdfBlob, pdfName);
  
      toast({
        title: "PDF Statement Generated",
        description: `Loan statement for ${loan.customers.name} has been downloaded as PDF.`,
      });
    } catch (error) {
      console.error("Error generating PDF statement:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF statement",
      });
    }
  };

  const handleLock = async (loan: Loan) => {
    if (loan.locked) {
      toast({
        variant: "destructive",
        title: "Already locked",
        description: "To unlock this loan, go to Settings page.",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('loans')
        .update({ locked: true })
        .eq('id', loan.id);

      if (error) throw error;

      setLoans(loans.map(l => 
        l.id === loan.id ? { ...l, locked: true } : l
      ));

      toast({
        title: "Loan locked",
        description: "Loan can no longer be edited or deleted. Go to Settings to unlock.",
      });
    } catch (error) {
      console.error('Error locking loan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to lock loan",
      });
    }
  };

  const handleQuickDelete = async (loan: Loan) => {
    if (loan.locked) {
      toast({
        variant: "destructive",
        title: "Cannot delete loan",
        description: "This loan is locked. Unlock it first to delete.",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete loan #${loan.loan_number} for ${loan.customers.name}? This action cannot be undone.`)) return;

    try {
      // First delete related transactions
      await supabase
        .from('loan_transactions')
        .delete()
        .eq('loan_id', loan.id);

      // Then delete the loan
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loan.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Loan deleted successfully!",
      });

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting loan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete loan.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user && loans.length > 0) {
      const loanIds = loans.map(l => l.id);
      const fetchAllTransactions = async () => {
        const { data } = await supabase
          .from('loan_transactions')
          .select('*')
          .in('loan_id', loanIds);
        setTransactions((data as any[]) || []);
      };
      fetchAllTransactions();
    }
  }, [user, loans]);

  const filteredLoans = loans.filter(loan => {
    // Filter by status first
    const balance = calculateLoanBalance(loan.id);
    const interest = calculateInterest(loan, balance);
    const outstanding = balance + interest;
    const isClosed = outstanding <= 0;
    
    if (status === 'active' && isClosed) return false;
    if (status === 'closed' && !isClosed) return false;
    
    // Then filter by search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loan.customers.name.toLowerCase().includes(query) ||
      loan.loan_number?.toLowerCase().includes(query) ||
      loan.description?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <div>Loading loans...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by customer, loan ID, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={() => setAddLoanDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Loan
        </Button>
      </div>

      {filteredLoans.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'No loans found matching your search.' 
                : status === 'closed' 
                  ? 'No closed loans yet.' 
                  : 'No active loans yet. Create your first loan!'}
            </p>
          </CardContent>
        </Card>
      )}

      {filteredLoans.map((loan) => {
        const balance = calculateLoanBalance(loan.id);
        const interest = calculateInterest(loan, balance);
        const outstanding = balance + interest;
        const totalAmount = loan.principal_amount + interest;
        const isClosed = outstanding <= 0;
        const totalPaid = loan.principal_amount - balance;
        
        return (
          <Card key={loan.id} className={`${isClosed ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{loan.customers.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      #{loan.loan_number}
                    </Badge>
                  </div>
                  {loan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{loan.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={isClosed ? 'secondary' : 'default'}>
                    {isClosed ? 'Closed' : 'Active'}
                  </Badge>
                  <Badge variant="outline">
                    {loan.interest_type === 'none' ? 'No Interest' : 
                     `${loan.interest_rate}% ${loan.interest_type}`}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Principal</p>
                  <p className="font-semibold">₹{loan.principal_amount.toFixed(2)}</p>
                </div>
                {loan.processing_fee && loan.processing_fee > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Processing Fee</p>
                    <p className="font-semibold text-blue-600">₹{loan.processing_fee.toFixed(2)}</p>
                  </div>
                )}
                {loan.total_outstanding && (
                  <div>
                    <p className="text-sm text-muted-foreground">Total Outstanding</p>
                    <p className="font-semibold text-orange-600">₹{loan.total_outstanding.toFixed(2)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Interest</p>
                  <p className="font-semibold text-orange-600">₹{interest.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-semibold text-primary">₹{totalAmount.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">EMI Amount</p>
                  <p className="font-semibold text-purple-600">
                    {loan.emi_amount ? `₹${loan.emi_amount.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Collected Amount</p>
                  <p className="font-semibold text-green-600">₹{totalPaid.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className={`font-semibold ${isClosed ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{outstanding.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Date</p>
                  <p className="font-semibold">{new Date(loan.loan_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex space-x-2 flex-wrap">
                {!isClosed && (
                  <>
                    {controlSettings.allowAddPayment && (
                      <Button size="sm" onClick={() => showPayment(loan)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Payment
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => showLedger(loan)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View Ledger
                    </Button>
                  </>
                )}
                {isClosed && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => generateLoanStatement(loan)}>
                      <FileText className="h-4 w-4 mr-1" />
                      Text
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => generatePDFStatement(loan)}>
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                )}
                <Button
                  variant={loan.locked ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLock(loan)}
                  title={loan.locked ? "Locked - Unlock from Settings" : "Lock loan"}
                >
                  <Lock className="h-4 w-4" />
                </Button>
                {controlSettings.allowEdit && !isClosed && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEditLoan(loan)}
                    disabled={loan.locked}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {controlSettings.allowDelete && !isClosed && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleQuickDelete(loan)}
                    disabled={loan.locked}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment - {selectedLoan?.customers.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (₹)</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                placeholder="Enter payment amount"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select 
                value={paymentData.type} 
                onValueChange={(value: any) => setPaymentData({ ...paymentData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal Only</SelectItem>
                  <SelectItem value="interest">Interest Only</SelectItem>
                  <SelectItem value="mixed">Mixed (Principal + Interest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select 
                value={paymentData.payment_mode} 
                onValueChange={(value: any) => setPaymentData({ ...paymentData, payment_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Input
                id="payment-notes"
                placeholder="Add any notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </div>

            {controlSettings.allowRecordPayment && (
              <Button type="submit" className="w-full">
                Record Payment
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Ledger Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ledger - {selectedLoan?.customers.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLoan && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Principal Amount</p>
                    <p className="font-semibold">₹{selectedLoan.principal_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Interest</p>
                    <p className="font-semibold text-orange-600">
                      ₹{calculateInterest(selectedLoan, calculateLoanBalance(selectedLoan.id)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-center">No payments recorded yet.</p>
              ) : (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">₹{transaction.amount.toFixed(2)}</p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{transaction.transaction_type}</Badge>
                        <Badge variant="secondary">{transaction.payment_mode}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(transaction.payment_date).toLocaleDateString()}
                        </span>
                      </div>
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{transaction.notes}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Loan Dialog */}
      <EditLoanDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        loan={selectedLoan}
        onLoanUpdated={() => {
          fetchLoans();
          onUpdate();
        }}
      />

      {/* Add Loan Dialog */}
      <AddLoanDialog
        open={addLoanDialogOpen}
        onOpenChange={setAddLoanDialogOpen}
        onLoanAdded={() => {
          fetchLoans();
          onUpdate();
        }}
      />
    </div>
  );
};

export default LoansList;
