import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye, EyeOff, ArrowLeft, FileText, ArrowRightLeft, ChevronUp, ChevronDown, Menu, Banknote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddFirmAccountDialog } from '@/components/AddFirmAccountDialog';
import { TransferBetweenAccountsDialog } from '@/components/TransferBetweenAccountsDialog';
import { AddChequeDialog } from '@/components/AddChequeDialog';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

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
  display_order: number;
}

export default function FirmAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<FirmAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showReceiveChequeDialog, setShowReceiveChequeDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_accounts')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate current_balance from transaction history for each account
      const accountsWithCalculatedBalance = await Promise.all(
        (data || []).map(async (account, idx) => {
          const { data: txns } = await supabase
            .from('firm_transactions')
            .select('amount, transaction_type')
            .eq('firm_account_id', account.id);

          const calculatedBalance = (txns || []).reduce((balance, txn) => {
            if (txn.transaction_type === 'partner_deposit' || txn.transaction_type === 'income') {
              return balance + txn.amount;
            } else if (txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' || txn.transaction_type === 'refund') {
              return balance - txn.amount;
            }
            return balance;
          }, account.opening_balance);

          return {
            ...account,
            current_balance: calculatedBalance,
            display_order: account.display_order ?? idx
          };
        })
      );

      setAccounts(accountsWithCalculatedBalance);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load firm accounts');
    } finally {
      setLoading(false);
    }
  };

  const toggleAccountStatus = async (accountId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('firm_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', accountId);

      if (error) throw error;
      toast.success(`Account ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchAccounts();
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account');
    }
  };

  const moveAccount = async (accountId: string, direction: 'up' | 'down', isActive: boolean) => {
    const filteredAccounts = accounts.filter(a => a.is_active === isActive);
    const currentIndex = filteredAccounts.findIndex(a => a.id === accountId);
    
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === filteredAccounts.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const swapAccount = filteredAccounts[newIndex];
    const currentAccount = filteredAccounts[currentIndex];

    // Use distinct order values based on index positions
    const currentNewOrder = newIndex;
    const swapNewOrder = currentIndex;

    try {
      // Update both accounts with new order values
      const { error: error1 } = await supabase
        .from('firm_accounts')
        .update({ display_order: currentNewOrder })
        .eq('id', currentAccount.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('firm_accounts')
        .update({ display_order: swapNewOrder })
        .eq('id', swapAccount.id);

      if (error2) throw error2;

      toast.success('Account order updated');
      fetchAccounts();
    } catch (error) {
      console.error('Error reordering accounts:', error);
      toast.error('Failed to reorder accounts');
    }
  };

  const handleViewStatement = (accountId: string) => {
    navigate(`/firm-accounts/${accountId}`);
  };

  const handleTransfer = (accountId: string, accountName: string) => {
    setSelectedAccount({ id: accountId, name: accountName });
    setShowTransferDialog(true);
  };

  const activeAccounts = accounts.filter(a => a.is_active);
  const inactiveAccounts = accounts.filter(a => !a.is_active);

  const renderAccountCard = (account: FirmAccount, index: number, list: FirmAccount[]) => (
    <Card key={account.id} className={!account.is_active ? 'opacity-60' : ''}>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className="break-words">{account.account_name}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveAccount(account.id, 'up', account.is_active)}
              disabled={index === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveAccount(account.id, 'down', account.is_active)}
              disabled={index === list.length - 1}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAccountStatus(account.id, account.is_active)}
            >
              {account.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">Type:</span>{' '}
            <span className="capitalize break-words">{account.account_type}</span>
          </p>
          {account.account_type === 'bank' && (
            <>
              {account.bank_name && (
                <p className="text-sm">
                  <span className="font-medium">Bank:</span> <span className="break-words">{account.bank_name}</span>
                </p>
              )}
              {account.account_number && (
                <p className="text-sm">
                  <span className="font-medium">Account #:</span> <span className="break-words">{account.account_number}</span>
                </p>
              )}
            </>
          )}
          <p className="text-sm">
            <span className="font-medium">Opening Balance:</span> ₹
            {account.opening_balance.toFixed(2)}
          </p>
          <p className="text-lg font-bold break-words">
            Current Balance: ₹{account.current_balance.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            Status: {account.is_active ? 'Active' : 'Inactive'}
          </p>
          <div className="flex flex-row gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleViewStatement(account.id)}
            >
              <FileText className="h-4 w-4 mr-2" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleTransfer(account.id, account.account_name)}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transfer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar 
          onSettingsClick={() => navigate('/settings')} 
          onProfileClick={() => navigate('/profile')} 
        />
        <main className="flex-1">
          <div className="container mx-auto p-6">
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <SidebarTrigger>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SidebarTrigger>
                <h1 className="text-2xl sm:text-3xl font-bold">Firm Accounts</h1>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setShowReceiveChequeDialog(true)}>
                  <Banknote className="h-4 w-4 mr-2" />
                  Receive Money
                </Button>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="active">
                  Active Accounts ({activeAccounts.length})
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Inactive Accounts ({inactiveAccounts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                {activeAccounts.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">No active accounts found. Create one to get started.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activeAccounts.map((account, index) => 
                      renderAccountCard(account, index, activeAccounts)
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inactive">
                {inactiveAccounts.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">No inactive accounts.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {inactiveAccounts.map((account, index) => 
                      renderAccountCard(account, index, inactiveAccounts)
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <AddFirmAccountDialog
              open={showAddDialog}
              onOpenChange={setShowAddDialog}
              onAccountAdded={fetchAccounts}
            />

            {selectedAccount && (
              <TransferBetweenAccountsDialog
                open={showTransferDialog}
                onOpenChange={setShowTransferDialog}
                fromAccountId={selectedAccount.id}
                fromAccountName={selectedAccount.name}
                onTransferComplete={fetchAccounts}
              />
            )}

            <AddChequeDialog
              open={showReceiveChequeDialog}
              onOpenChange={setShowReceiveChequeDialog}
              type="received"
              onSuccess={fetchAccounts}
            />

          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
