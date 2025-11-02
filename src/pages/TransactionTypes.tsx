import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CustomTransactionType {
  id: string;
  name: string;
  category: 'expense' | 'deposit';
}

export default function TransactionTypes() {
  const { user } = useAuth();
  const [customTypes, setCustomTypes] = useState<CustomTransactionType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState<'expense' | 'deposit'>('expense');
  const [isLoading, setIsLoading] = useState(false);

  // Default transaction types
  const defaultExpenseTypes = [
    { name: 'GST Tax Payment', value: 'gst_tax_payment' },
    { name: 'Income Tax Payment', value: 'income_tax_payment' },
    { name: 'Paid To CA', value: 'paid_to_ca' },
    { name: 'Paid To Supplier', value: 'paid_to_supplier' },
    { name: 'General Expense', value: 'expense' },
  ];

  const defaultDepositTypes = [
    { name: 'Partner Deposit', value: 'partner_deposit' },
    { name: 'Income', value: 'income' },
    { name: 'Refund', value: 'refund' },
  ];

  useEffect(() => {
    if (user) {
      fetchCustomTypes();
    }
  }, [user]);

  const fetchCustomTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_transaction_types')
        .select('*')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;

      // Map custom types with category based on naming convention
      const typesWithCategory = (data || []).map(type => ({
        id: type.id,
        name: type.name,
        category: type.name.toLowerCase().includes('deposit') || 
                  type.name.toLowerCase().includes('income') ? 
                  'deposit' as const : 'expense' as const,
      }));

      setCustomTypes(typesWithCategory);
    } catch (error: any) {
      console.error('Error fetching custom types:', error);
      toast.error('Failed to load custom transaction types');
    }
  };

  const handleAddType = async () => {
    if (!user || !newTypeName.trim()) {
      toast.error('Please enter a type name');
      return;
    }

    setIsLoading(true);
    try {
      // Check for duplicates (including default types)
      const allExistingTypes = [
        ...defaultExpenseTypes.map(t => t.name.toLowerCase()),
        ...defaultDepositTypes.map(t => t.name.toLowerCase()),
        ...customTypes.map(t => t.name.toLowerCase()),
      ];

      if (allExistingTypes.includes(newTypeName.trim().toLowerCase())) {
        toast.error('This transaction type already exists');
        return;
      }

      const { error } = await supabase
        .from('custom_transaction_types')
        .insert({
          user_id: user.id,
          name: newTypeName.trim(),
        });

      if (error) throw error;

      toast.success('Transaction type added successfully');
      setNewTypeName('');
      fetchCustomTypes();
    } catch (error: any) {
      console.error('Error adding custom type:', error);
      toast.error(error.message || 'Failed to add transaction type');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction type?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_transaction_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Transaction type deleted successfully');
      fetchCustomTypes();
    } catch (error: any) {
      console.error('Error deleting custom type:', error);
      toast.error(error.message || 'Failed to delete transaction type');
    }
  };

  const getFilteredCustomTypes = (category: 'expense' | 'deposit') => {
    return customTypes.filter(type => type.category === category);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar 
          onSettingsClick={() => {}} 
          onProfileClick={() => {}}
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Transaction Types Management</h1>
              <p className="text-muted-foreground">
                Manage your transaction types for better categorization
              </p>
            </div>

            {/* Add New Type */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Transaction Type</CardTitle>
                <CardDescription>
                  Create custom transaction types for your firm account transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter transaction type name (e.g., 'Electricity Bill')"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddType()}
                    className="flex-1"
                  />
                  <select
                    value={newTypeCategory}
                    onChange={(e) => setNewTypeCategory(e.target.value as 'expense' | 'deposit')}
                    className="px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="expense">Expense</option>
                    <option value="deposit">Deposit</option>
                  </select>
                  <Button onClick={handleAddType} disabled={isLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Type
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Types Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expense Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="destructive">Expense</Badge>
                    Transaction Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type Name</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Default Expense Types */}
                      {defaultExpenseTypes.map((type) => (
                        <TableRow key={type.value}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">Default</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Custom Expense Types */}
                      {getFilteredCustomTypes('expense').map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteType(type.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                      {getFilteredCustomTypes('expense').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            No custom expense types added
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Deposit Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge className="bg-green-600">Deposit</Badge>
                    Transaction Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type Name</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Default Deposit Types */}
                      {defaultDepositTypes.map((type) => (
                        <TableRow key={type.value}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">Default</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Custom Deposit Types */}
                      {getFilteredCustomTypes('deposit').map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteType(type.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                      {getFilteredCustomTypes('deposit').length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground">
                            No custom deposit types added
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
