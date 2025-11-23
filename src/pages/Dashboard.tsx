import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wallet, 
  TrendingUp, 
  Users, 
  DollarSign,
  LogOut,
  Plus
} from 'lucide-react';
import LoansList from '@/components/LoansList';
import AddLoanDialog from '@/components/AddLoanDialog';
import CustomersList from '@/components/CustomersList';
import AddCustomerDialog from '@/components/AddCustomerDialog';
import CustomerSummary from '@/components/CustomerSummary';
import DaywiseCustomerManager from '@/components/DaywiseCustomerManager';
import DaywisePayment from '@/components/DaywisePayment';
import DateWisePayments from '@/components/DateWisePayments';
import MahajanList from '@/components/MahajanList';
import AddMahajanDialog from '@/components/AddMahajanDialog';
import MahajanSummary from '@/components/MahajanSummary';
import { BillCustomersList } from '@/components/BillCustomersList';
import { TabSettings } from '@/pages/Settings';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useControl } from '@/contexts/ControlContext';
import { ChequeReminderDialog } from '@/components/ChequeReminderDialog';

interface DashboardStats {
  activeLoans: number;
  todaysCollection: number;
  thisMonthDisbursed: number;
  thisMonthSales: number;
}

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [stats, setStats] = useState<DashboardStats>({
    activeLoans: 0,
    todaysCollection: 0,
    thisMonthDisbursed: 0,
    thisMonthSales: 0,
  });
  const [addLoanDialogOpen, setAddLoanDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('customers');
  const [showChequeReminders, setShowChequeReminders] = useState(false);
  const [tabSettings, setTabSettings] = useState<TabSettings>({
    loans: true,
    customers: true,
    mahajans: true,
    bill_customers: true,
    daywise: true,
    payments: true,
  });

  // Define functions before using them in useEffect
  const fetchTabSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('visible_tabs')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching tab settings:', error);
        return;
      }

      if (data) {
        const settings = data.visible_tabs as unknown as TabSettings;
        // Ensure mahajans and bill_customers fields exist, default to true if missing
        const settingsWithDefaults = {
          ...settings,
          mahajans: settings.mahajans !== undefined ? settings.mahajans : true,
          bill_customers: (settings as any).bill_customers !== undefined ? (settings as any).bill_customers : true
        };
        setTabSettings(settingsWithDefaults);
      } else {
        // If no settings exist, create default settings
        const defaultSettings = {
          loans: true,
          customers: true,
          mahajans: true,
          bill_customers: true,
          daywise: true,
          payments: true,
        };
        
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            visible_tabs: defaultSettings,
          });

        if (insertError) {
          console.error('Error creating default settings:', insertError);
        } else {
          setTabSettings(defaultSettings);
        }
      }
    } catch (error) {
      console.error('Error in fetchTabSettings:', error);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Get loans data
      const { data: loans } = await supabase
        .from('loans')
        .select('is_active')
        .eq('user_id', user.id);
      
      const activeLoans = loans?.filter(loan => loan.is_active).length || 0;


      // Get today's collection
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const { data: todaysTransactions } = await supabase
        .from('loan_transactions')
        .select('amount, loans!inner(user_id)')
        .eq('loans.user_id', user.id)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);
      
      const todaysCollection = todaysTransactions?.reduce((sum, trans) => sum + Number(trans.amount), 0) || 0;

      // Get this month's loan disbursed
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      
      const { data: thisMonthLoans } = await supabase
        .from('loans')
        .select('principal_amount')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);
      
      const thisMonthDisbursed = thisMonthLoans?.reduce((sum, loan) => sum + Number(loan.principal_amount), 0) || 0;

      // Get this month's sales
      const { data: thisMonthSalesData } = await supabase
        .from('sales')
        .select('sale_amount')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);
      
      const thisMonthSales = thisMonthSalesData?.reduce((sum, sale) => sum + Number(sale.sale_amount), 0) || 0;

      setStats({
        activeLoans,
        todaysCollection,
        thisMonthDisbursed,
        thisMonthSales,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Dashboard: Starting sign out...');
      await signOut();
      
      console.log('Dashboard: Sign out completed, redirecting to auth page...');
      
      // Force navigation to auth page as backup
      setTimeout(() => {
        navigate('/auth', { replace: true });
      }, 100);
      
    } catch (error) {
      console.error('Dashboard: Sign out error:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out',
        variant: 'destructive',
      });
    }
  };

  // All hooks must be called before any early returns
  useEffect(() => {
    if (user) {
      fetchTabSettings();
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [user]);
  
  // Show cheque reminder dialog after login
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        setShowChequeReminders(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);
  
  // Show loading spinner while auth is loading
  if (loading) {
    return <LoadingSpinner message="Initializing your dashboard..." size="lg" />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar
          onSettingsClick={() => navigate('/settings')}
          onProfileClick={() => navigate('/profile')}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b bg-card">
            <div className="w-full px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <SidebarTrigger />
                  <Wallet className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">Griha Sajjwa 1.0</h1>
                </div>
                <Button variant="outline" onClick={handleSignOut} className="text-xs sm:text-sm">
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Out</span>
                </Button>
              </div>
            </div>
          </div>

      <div className="w-full px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card 
            className="p-3 sm:p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/reports/collection')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Today's Collection</CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 truncate">
                ₹{stats.todaysCollection.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card 
            className="p-3 sm:p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/reports/disbursed')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">This Month Disbursed</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-indigo-600 truncate">
                ₹{stats.thisMonthDisbursed.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card 
            className="p-3 sm:p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/reports/sales')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">This Month Sales</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 truncate">
                ₹{stats.thisMonthSales.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card 
            className="p-3 sm:p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/reports/active-loans')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">Active Loans</CardTitle>
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold">{stats.activeLoans}</div>
            </CardContent>
          </Card>
        </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto">
              <TabsList className="grid w-full min-w-max" style={{ gridTemplateColumns: `repeat(${Object.values(tabSettings).filter(Boolean).length}, 1fr)` }}>
                {tabSettings.loans && <TabsTrigger value="loans" className="text-xs sm:text-sm">Loans</TabsTrigger>}
                {tabSettings.customers && <TabsTrigger value="customers" className="text-xs sm:text-sm">Loan Customers</TabsTrigger>}
                {tabSettings.mahajans && <TabsTrigger value="mahajans" className="text-xs sm:text-sm">Mahajans</TabsTrigger>}
                {tabSettings.bill_customers && <TabsTrigger value="bill_customers" className="text-xs sm:text-sm">Sale Customers</TabsTrigger>}
                {tabSettings.daywise && <TabsTrigger value="daywise" className="text-xs sm:text-sm">Collection</TabsTrigger>}
                {tabSettings.payments && <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>}
              </TabsList>
            </div>

            {tabSettings.loans && (
              <TabsContent value="loans" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h2 className="text-lg sm:text-xl font-semibold">Loans & Lending</h2>
                    <Button onClick={() => setAddLoanDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Loan
                    </Button>
                  </div>
                  
                  {/* Sub-tabs for Loans */}
                  <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="active" className="text-xs sm:text-sm">Active Loans</TabsTrigger>
                      <TabsTrigger value="closed" className="text-xs sm:text-sm">Closed Loans</TabsTrigger>
                    </TabsList>
                    <TabsContent value="active" className="mt-4">
                      <LoansList onUpdate={fetchStats} status="active" />
                    </TabsContent>
                    <TabsContent value="closed" className="mt-4">
                      <LoansList onUpdate={fetchStats} status="closed" />
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            )}

            {tabSettings.customers && (
              <TabsContent value="customers" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h2 className="text-lg sm:text-xl font-semibold">Customers</h2>
                    <AddCustomerDialog onCustomerAdded={() => {
                      // Trigger refresh for any components that need it
                      window.dispatchEvent(new CustomEvent('refresh-customers'));
                    }} />
                  </div>
                  
                  {/* Sub-tabs for Customers */}
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className={`grid ${controlSettings.allowPaymentManager ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <TabsTrigger value="list" className="text-xs sm:text-sm">Customer List</TabsTrigger>
                      <TabsTrigger value="summary" className="text-xs sm:text-sm">Summary Report</TabsTrigger>
                      {controlSettings.allowPaymentManager && (
                        <TabsTrigger value="payment-manager" className="text-xs sm:text-sm">
                          <span className="hidden sm:inline">Payment Manager</span>
                          <span className="sm:hidden">Payments</span>
                        </TabsTrigger>
                      )}
                    </TabsList>
                    <TabsContent value="list" className="mt-4">
                      <CustomersList onUpdate={fetchStats} />
                    </TabsContent>
                    <TabsContent value="summary" className="mt-4">
                      <CustomerSummary />
                    </TabsContent>
                    {controlSettings.allowPaymentManager && (
                      <TabsContent value="payment-manager" className="mt-4">
                        <DaywiseCustomerManager />
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              </TabsContent>
            )}

            {tabSettings.mahajans && (
              <TabsContent value="mahajans" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h2 className="text-lg sm:text-xl font-semibold">Mahajans</h2>
                    <AddMahajanDialog onMahajanAdded={() => {
                      // Trigger refresh for any components that need it
                      window.dispatchEvent(new CustomEvent('refresh-mahajans'));
                    }} />
                  </div>
                  
                  {/* Sub-tabs for Mahajans */}
                  <Tabs defaultValue="list" className="w-full">
                    <TabsList className={`grid ${controlSettings.allowPaymentManager ? 'grid-cols-2' : 'grid-cols-2'}`}>
                      <TabsTrigger value="list" className="text-xs sm:text-sm">Mahajan List</TabsTrigger>
                      <TabsTrigger value="summary" className="text-xs sm:text-sm">Summary Report</TabsTrigger>
                      {/* {controlSettings.allowPaymentManager && (
                        <TabsTrigger value="payment-manager" className="text-xs sm:text-sm">
                          <span className="hidden sm:inline">Payment Manager</span>
                          <span className="sm:hidden">Payments</span>
                        </TabsTrigger>
                      )} */}
                    </TabsList>
                    <TabsContent value="list" className="mt-4">
                      <MahajanList onUpdate={fetchStats} />
                    </TabsContent>
                    <TabsContent value="summary" className="mt-4">
                      <MahajanSummary />
                    </TabsContent>
                    {controlSettings.allowPaymentManager && (
                      <TabsContent value="payment-manager" className="mt-4">
                        <DaywiseCustomerManager />
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              </TabsContent>
            )}

            {tabSettings.daywise && (
              <TabsContent value="daywise" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Daywise Payment Schedule</h2>
                  <AddCustomerDialog onCustomerAdded={() => {
                    window.dispatchEvent(new CustomEvent('refresh-customers'));
                  }} />
                </div>
                <DaywisePayment onUpdate={fetchStats} />
              </TabsContent>
            )}

            {tabSettings.bill_customers && (
              <TabsContent value="bill_customers" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <BillCustomersList />
                </div>
              </TabsContent>
            )}

            {tabSettings.payments && (
              <TabsContent value="payments" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold">Date-wise Payment Records</h2>
                </div>
                <DateWisePayments onUpdate={fetchStats} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Add Loan Dialog */}
      <AddLoanDialog
        open={addLoanDialogOpen}
        onOpenChange={setAddLoanDialogOpen}
        onLoanAdded={() => {
          fetchStats();
          window.dispatchEvent(new CustomEvent('refresh-loans'));
        }}
      />

      {/* Cheque Reminder Dialog */}
      <ChequeReminderDialog 
        open={showChequeReminders} 
        onOpenChange={setShowChequeReminders}
      />
    </div>
    </SidebarProvider>
  );
};

export default Dashboard;
