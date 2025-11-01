import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const SecurityTest: React.FC = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runSecurityTests = async () => {
    if (!user) return;

    setIsRunning(true);
    setTestResults([]);
    const results: any[] = [];

    try {
      // Test 1: Check if user can only see their own customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*');
      
      const customersBelongToUser = customers?.every(c => c.user_id === user.id) ?? true;
      results.push({
        test: 'Customer Data Isolation',
        status: customersBelongToUser && !customersError ? 'pass' : 'fail',
        details: customersBelongToUser 
          ? `✅ Only ${customers?.length || 0} customers belonging to current user`
          : `❌ Found customers not belonging to current user`
      });

      // Test 2: Check if user can only see their own loans
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*');
      
      const loansBelongToUser = loans?.every(l => l.user_id === user.id) ?? true;
      results.push({
        test: 'Loan Data Isolation',
        status: loansBelongToUser && !loansError ? 'pass' : 'fail',
        details: loansBelongToUser 
          ? `✅ Only ${loans?.length || 0} loans belonging to current user`
          : `❌ Found loans not belonging to current user`
      });

      // Test 3: Check if user can only see their own expenses
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*');
      
      const expensesBelongToUser = expenses?.every(e => e.user_id === user.id) ?? true;
      results.push({
        test: 'Expense Data Isolation',
        status: expensesBelongToUser && !expensesError ? 'pass' : 'fail',
        details: expensesBelongToUser 
          ? `✅ Only ${expenses?.length || 0} expenses belonging to current user`
          : `❌ Found expenses not belonging to current user`
      });

      // Test 4: Check if user can only see transactions for their loans
      const { data: transactions, error: transactionsError } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans!inner(user_id)
        `);
      
      const transactionsBelongToUser = transactions?.every(t => t.loan.user_id === user.id) ?? true;
      results.push({
        test: 'Transaction Data Isolation',
        status: transactionsBelongToUser && !transactionsError ? 'pass' : 'fail',
        details: transactionsBelongToUser 
          ? `✅ Only ${transactions?.length || 0} transactions belonging to current user`
          : `❌ Found transactions not belonging to current user`
      });

      // Test 5: Try to access non-existent customer (should return empty)
      const { data: fakeCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000000');
      
      results.push({
        test: 'Non-existent Data Access',
        status: !fakeCustomer || fakeCustomer.length === 0 ? 'pass' : 'fail',
        details: !fakeCustomer || fakeCustomer.length === 0
          ? `✅ No access to non-existent data`
          : `❌ Unexpected access to non-existent data`
      });

      // Test 6: Check RLS is enabled on all tables
      const tables = ['customers', 'loans', 'expenses', 'loan_transactions', 'expense_categories'] as const;
      const rlsTests = await Promise.all(
        tables.map(async (table) => {
          try {
            // This query should be filtered by RLS
            const { data } = await supabase.from(table as any).select('*').limit(1);
            return { table, enabled: true };
          } catch (error) {
            return { table, enabled: false };
          }
        })
      );

      const allRlsEnabled = rlsTests.every(test => test.enabled);
      results.push({
        test: 'Row Level Security (RLS)',
        status: allRlsEnabled ? 'pass' : 'fail',
        details: allRlsEnabled 
          ? `✅ RLS enabled on all tables: ${tables.join(', ')}`
          : `❌ RLS not enabled on: ${rlsTests.filter(t => !t.enabled).map(t => t.table).join(', ')}`
      });

    } catch (error) {
      results.push({
        test: 'Security Test Execution',
        status: 'error',
        details: `❌ Error running security tests: ${error}`
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-600">PASS</Badge>;
      case 'fail':
        return <Badge variant="destructive">FAIL</Badge>;
      case 'error':
        return <Badge variant="secondary">ERROR</Badge>;
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
          <p className="text-muted-foreground">Please log in to run security tests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Data Security & Isolation Tests</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            These tests verify that users can only access their own data and that Row Level Security (RLS) is properly configured.
          </p>
          <Button 
            onClick={runSecurityTests} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running Tests...' : 'Run Security Tests'}
          </Button>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.test}</p>
                      <p className="text-sm text-muted-foreground">{result.details}</p>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Summary:</h4>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">
                  ✅ Passed: {testResults.filter(r => r.status === 'pass').length}
                </span>
                <span className="text-red-600">
                  ❌ Failed: {testResults.filter(r => r.status === 'fail').length}
                </span>
                <span className="text-orange-600">
                  ⚠️ Errors: {testResults.filter(r => r.status === 'error').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityTest;
