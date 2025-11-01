import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Phone, MapPin, IndianRupee, Eye, Clock } from 'lucide-react';
import CustomerDetails from './CustomerDetails';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
  loans?: Array<{
    id: string;
    principal_amount: number;
    is_active: boolean;
    emi_amount?: number;
  }>;
}

interface DaywisePaymentProps {
  onUpdate?: () => void;
}

const DaywisePayment: React.FC<DaywisePaymentProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const daysOfWeek = [
    'sunday',
    'monday', 
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ];

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

  useEffect(() => {
    const handleCustomerAdded = () => {
      fetchCustomers();
    };

    window.addEventListener('customer-added', handleCustomerAdded);
    return () => window.removeEventListener('customer-added', handleCustomerAdded);
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Fetch customers with their loans
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          loans:loans(id, principal_amount, is_active, interest_rate, interest_type, loan_date, emi_amount)
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
      const balance = calculateLoanBalance(customer.id, loan.id);
      const interest = calculateInterest(loan, balance);
      return sum + balance + interest;
    }, 0);
  };

  const calculateCustomerEMIAmount = (customer: Customer) => {
    const activeLoans = customer.loans?.filter(loan => loan.is_active) || [];
    return activeLoans.reduce((sum, loan) => {
      return sum + (loan.emi_amount || 0);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getCustomersByDay = (day: string) => {
    return customers.filter(customer => customer.payment_day === day);
  };

  const handleDayClick = (day: string) => {
    navigate(`/collection?day=${day}`);
  };


  const getCurrentDay = () => {
    const today = new Date();
    const dayIndex = today.getDay();
    return daysOfWeek[dayIndex];
  };

  const getUpcomingDays = () => {
    const today = new Date();
    const currentDayIndex = today.getDay();
    const upcomingDays = [];
    
    for (let i = 0; i < 7; i++) {
      const dayIndex = (currentDayIndex + i) % 7;
      upcomingDays.push(daysOfWeek[dayIndex]);
    }
    
    return upcomingDays;
  };

  if (selectedCustomer) {
    return (
      <CustomerDetails 
        customer={selectedCustomer} 
        onBack={() => setSelectedCustomer(null)} 
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading payment schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Daywise Payment Schedule</h2>
        <p className="text-muted-foreground">
          Customers organized by their preferred payment days
        </p>
      </div>

      {/* Payment Schedule Summary - Moved to top */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Schedule Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {daysOfWeek.map((day) => {
              const dayCustomers = getCustomersByDay(day);
              const totalOutstanding = dayCustomers.reduce((sum, customer) => {
                return sum + calculateCustomerOutstanding(customer);
              }, 0);
              const totalEMIAmount = dayCustomers.reduce((sum, customer) => {
                return sum + calculateCustomerEMIAmount(customer);
              }, 0);
              
              const dayColors = {
                sunday: 'bg-red-100 border-red-200',
                monday: 'bg-blue-100 border-blue-200',
                tuesday: 'bg-green-100 border-green-200',
                wednesday: 'bg-yellow-100 border-yellow-200',
                thursday: 'bg-purple-100 border-purple-200',
                friday: 'bg-pink-100 border-pink-200',
                saturday: 'bg-indigo-100 border-indigo-200'
              };

              return (
                <div 
                  key={day} 
                  className={`text-center p-4 rounded-lg border-2 ${dayColors[day as keyof typeof dayColors]} shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    {dayLabels[day as keyof typeof dayLabels]}
                  </div>
                  <div className="text-xl font-bold text-gray-800 mb-1">{dayCustomers.length}</div>
                  <div className="text-xs text-gray-600 mb-3">customers</div>
                  <div className="text-sm font-semibold text-green-700">
                    {formatCurrency(totalOutstanding)}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">Outstanding</div>
                  <div className="text-sm font-semibold text-purple-700">
                    {formatCurrency(totalEMIAmount)}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">EMI Amount</div>
                  <div className="text-xs text-blue-600 font-medium">Click to collect</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

  
    </div>
  );
};

export default DaywisePayment;
