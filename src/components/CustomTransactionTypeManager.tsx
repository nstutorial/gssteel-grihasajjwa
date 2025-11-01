import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2 } from 'lucide-react';

interface CustomTransactionType {
  id: string;
  name: string;
  created_at: string;
}

interface CustomTransactionTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomTransactionTypeManager({ open, onOpenChange }: CustomTransactionTypeManagerProps) {
  const { user } = useAuth();
  const [types, setTypes] = useState<CustomTransactionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

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
      setTypes(data || []);
    } catch (error: any) {
      console.error('Error fetching custom types:', error);
      toast.error('Failed to load custom transaction types');
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      toast.error('Please enter a transaction type name');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('custom_transaction_types')
        .insert({
          user_id: user?.id,
          name: newTypeName.trim()
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This transaction type already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Transaction type added successfully');
      setNewTypeName('');
      setAddDialogOpen(false);
      fetchCustomTypes();
    } catch (error: any) {
      console.error('Error adding transaction type:', error);
      toast.error('Failed to add transaction type');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (typeId: string, typeName: string) => {
    if (!confirm(`Are you sure you want to delete "${typeName}"?`)) return;

    try {
      const { error } = await supabase
        .from('custom_transaction_types')
        .delete()
        .eq('id', typeId);

      if (error) throw error;

      toast.success('Transaction type deleted');
      fetchCustomTypes();
    } catch (error: any) {
      console.error('Error deleting transaction type:', error);
      toast.error('Failed to delete transaction type');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Custom Transaction Types</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          </div>

          {types.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom transaction types yet. Click "Add Type" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction Type Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteType(type.id, type.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Transaction Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddType} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type_name">Transaction Type Name</Label>
              <Input
                id="type_name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g., Office Rent, Salary Payment"
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
