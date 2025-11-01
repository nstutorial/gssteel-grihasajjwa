import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Eye, EyeOff, ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddFirmAccountDialog } from '@/components/AddFirmAccountDialog';
import { useNavigate } from 'react-router-dom';

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

export default function FirmAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<FirmAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate current_balance from transaction history for each account
      const accountsWithCalculatedBalance = await Promise.all(
        (data || []).map(async (account) => {
          const { data: txns } = await supabase
            .from('firm_transactions')
            .select('amount, transaction_type')
            .eq('firm_account_id', account.id);

          const calculatedBalance = (txns || []).reduce((balance, txn) => {
            if (txn.transaction_type === 'partner_deposit' || txn.transaction_type === 'income') {
              return balance + txn.amount;
            } else if (txn.transaction_type === 'partner_withdrawal' || txn.transaction_type === 'expense' ||  txn.transaction_type === 'refund') {
              return balance - txn.amount;
            }
            return balance;
          }, account.opening_balance);

          return {
            ...account,
            current_balance: calculatedBalance
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

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  const handleViewStatement = (accountId: string) => {
    navigate(`/firm-accounts/${accountId}`);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Firm Accounts</h1>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className={!account.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{account.account_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAccountStatus(account.id, account.is_active)}
                >
                  {account.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Type:</span>{' '}
                  <span className="capitalize">{account.account_type}</span>
                </p>
                {account.account_type === 'bank' && (
                  <>
                    {account.bank_name && (
                      <p className="text-sm">
                        <span className="font-medium">Bank:</span> {account.bank_name}
                      </p>
                    )}
                    {account.account_number && (
                      <p className="text-sm">
                        <span className="font-medium">Account #:</span> {account.account_number}
                      </p>
                    )}
                  </>
                )}
                <p className="text-sm">
                  <span className="font-medium">Opening Balance:</span> ₹
                  {account.opening_balance.toFixed(2)}
                </p>
                <p className="text-lg font-bold">
                  Current Balance: ₹{account.current_balance.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: {account.is_active ? 'Active' : 'Inactive'}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => handleViewStatement(account.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No firm accounts found. Create one to get started.</p>
          </CardContent>
        </Card>
      )}

      <AddFirmAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAccountAdded={fetchAccounts}
      />
    </div>
  );
}
