import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useControl } from '@/contexts/ControlContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit } from 'lucide-react';


interface Loan {
  id: string;
  loan_number: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'daily' | 'monthly' | 'none';
  emi_amount?: number;
  emi_frequency?: 'weekly' | 'monthly';
  loan_date: string;
  due_date?: string;
  description?: string;
  is_active: boolean;
  customer_id: string;
  customers: {
    name: string;
    phone?: string;
  };
}

interface EditLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan | null;
  onLoanUpdated: () => void;
}

const EditLoanDialog: React.FC<EditLoanDialogProps> = ({
  open,
  onOpenChange,
  loan,
  onLoanUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    loan_number: '',
    principal_amount: '',
    interest_rate: '',
    interest_type: 'monthly' as 'daily' | 'monthly' | 'none',
    emi_amount: '',
    emi_frequency: 'weekly' as 'weekly' | 'monthly',
    loan_date: '',
    due_date: '',
    description: '',
    customer_id: '',
  });

  useEffect(() => {
    if (open && user && loan) {
      setFormData({
        loan_number: loan.loan_number || '',
        principal_amount: loan.principal_amount.toString(),
        interest_rate: loan.interest_rate.toString(),
        interest_type: loan.interest_type,
        emi_amount: loan.emi_amount ? loan.emi_amount.toString() : '',
        emi_frequency: loan.emi_frequency || 'weekly',
        loan_date: loan.loan_date.split('T')[0],
        due_date: loan.due_date ? loan.due_date.split('T')[0] : '',
        description: loan.description || '',
        customer_id: loan.customer_id,
      });
      
      // Fetch transactions for this loan
      fetchTransactions();
    }
  }, [open, user, loan]);

  const fetchTransactions = async () => {
    if (!loan) return;
    
    try {
      const { data, error } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loan.id);
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const calculateLoanBalance = (loanId: string, currentLoan: any) => {
    const loanTransactions = transactions.filter(t => t.loan_id === loanId);
    const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
    return currentLoan ? currentLoan.principal_amount - totalPaid : 0;
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !loan) return;
    
    // Check if loan is closed (outstanding balance <= 0)
    const balance = calculateLoanBalance(loan.id, loan);
    const interest = calculateInterest(loan, balance);
    const outstanding = balance + interest;
    const isClosed = outstanding <= 0;
    
    if (isClosed) {
      toast({
        title: "Cannot Edit Closed Loan",
        description: "Closed loans cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('loans')
        .update({
          loan_number: formData.loan_number.trim() || null,
          principal_amount: parseFloat(formData.principal_amount),
          interest_rate: parseFloat(formData.interest_rate),
          interest_type: formData.interest_type,
          emi_amount: formData.emi_amount ? parseFloat(formData.emi_amount) : null,
          emi_frequency: formData.emi_frequency,
          loan_date: formData.loan_date
            ? new Date(formData.loan_date).toISOString()
            : new Date().toISOString(),
          due_date: formData.due_date
            ? new Date(formData.due_date).toISOString()
            : null,
          description: formData.description.trim() || null,
          customer_id: formData.customer_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', loan.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Loan updated successfully!",
      });

      onLoanUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating loan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update loan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !loan) return;
    
    // Check if loan is closed (outstanding balance <= 0)
    const balance = calculateLoanBalance(loan.id, loan);
    const interest = calculateInterest(loan, balance);
    const outstanding = balance + interest;
    const isClosed = outstanding <= 0;
    
    if (isClosed) {
      toast({
        title: "Cannot Delete Closed Loan",
        description: "Closed loans cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    
    if (!confirm('Are you sure you want to delete this loan? This action cannot be undone.')) return;

    setLoading(true);
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

      onLoanUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting loan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete loan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Loan</DialogTitle>
          <DialogDescription>
            Update loan details including customer, amount, interest rate, and dates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal_amount">Principal Amount (₹) *</Label>
              <Input
                id="principal_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.principal_amount}
                onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate (%) *</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                min="0"
                max="1000"
                value={formData.interest_rate}
                onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Customer</Label>
            <div className="p-3 border rounded-md bg-muted/50">
              <p className="font-medium">{loan?.customers.name}</p>
              {loan?.customers.phone && (
                <p className="text-sm text-muted-foreground">{loan.customers.phone}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest_type">Interest Type *</Label>
            <Select
              value={formData.interest_type}
              onValueChange={(value: 'daily' | 'monthly' | 'none') =>
                setFormData({ ...formData, interest_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select interest type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="none">No Interest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emi_amount">EMI Amount (₹)</Label>
            <Input
              id="emi_amount"
              type="number"
              step="0.01"
              placeholder="Enter EMI amount"
              value={formData.emi_amount}
              onChange={(e) => setFormData({ ...formData, emi_amount: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>EMI Frequency</Label>
            <Select 
              value={formData.emi_frequency} 
              onValueChange={(value: 'weekly' | 'monthly') => setFormData({ ...formData, emi_frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_date">Loan Date *</Label>
              <Input
                id="loan_date"
                type="date"
                value={formData.loan_date}
                onChange={(e) => setFormData({ ...formData, loan_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date (Optional)</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Loan Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add any details for this loan..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-between">
            <div>
              {controlSettings.allowDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {controlSettings.allowEdit && (
                <Button type="submit" disabled={loading}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditLoanDialog;
