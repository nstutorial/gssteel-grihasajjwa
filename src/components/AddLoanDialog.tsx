import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
}

interface AddLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onLoanAdded: () => void;
}

const AddLoanDialog: React.FC<AddLoanDialogProps> = ({ open, onOpenChange, customer, onLoanAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    customerId: '',
    principalAmount: '',
    processingFee: '',
    description: '',
    interestRate: '',
    interestType: 'none' as 'daily' | 'monthly' | 'none',
    emiAmount: '',
    emiFrequency: 'weekly' as 'weekly' | 'monthly',
    loanDate: new Date().toISOString().split('T')[0],
    dueDate: '',
  });

  const totalOutstanding = formData.principalAmount && formData.processingFee 
    ? (parseFloat(formData.principalAmount) + parseFloat(formData.processingFee)).toFixed(2)
    : formData.principalAmount 
    ? parseFloat(formData.principalAmount).toFixed(2)
    : '0.00';

  useEffect(() => {
    if (user && open) {
      fetchCustomers();
    }
  }, [user, open]);

  useEffect(() => {
    if (customer && open) {
      setFormData(prev => ({ ...prev, customerId: customer.id }));
    }
  }, [customer, open]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const processingFeeAmount = formData.processingFee ? parseFloat(formData.processingFee) : 0;
      const principalAmountValue = parseFloat(formData.principalAmount);
      const totalOutstandingValue = principalAmountValue + processingFeeAmount;
      
      const { error } = await supabase
        .from('loans')
        .insert({
          user_id: user.id,
          customer_id: formData.customerId,
          principal_amount: principalAmountValue,
          processing_fee: processingFeeAmount,
          total_outstanding: totalOutstandingValue,
          description: formData.description,
          interest_rate: formData.interestType === 'none' ? 0 : parseFloat(formData.interestRate),
          interest_type: formData.interestType,
          emi_amount: formData.emiAmount ? parseFloat(formData.emiAmount) : null,
          emi_frequency: formData.emiFrequency,
          loan_date: formData.loanDate,
          due_date: formData.dueDate || null,
        });

      if (error) throw error;

      toast({
        title: "Loan created",
        description: "The loan has been successfully created.",
      });

      setFormData({
        customerId: '',
        principalAmount: '',
        processingFee: '',
        description: '',
        interestRate: '',
        interestType: 'none',
        emiAmount: '',
        emiFrequency: 'weekly',
        loanDate: new Date().toISOString().split('T')[0],
        dueDate: '',
      });
      
      onOpenChange(false);
      onLoanAdded();
    } catch (error) {
      console.error('Error creating loan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create loan. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            {customer ? (
              <Input
                value={customer.name}
                disabled
                className="bg-muted"
              />
            ) : (
              <Select value={formData.customerId} onValueChange={(value) => setFormData({ ...formData, customerId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="principal">Total Disbursed Amount (₹)</Label>
            <Input
              id="principal"
              type="number"
              step="0.01"
              placeholder="Enter loan amount"
              value={formData.principalAmount}
              onChange={(e) => setFormData({ ...formData, principalAmount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processing-fee">Advance / Loan Processing Amount (₹)</Label>
            <Input
              id="processing-fee"
              type="number"
              step="0.01"
              placeholder="Enter processing fee"
              value={formData.processingFee}
              onChange={(e) => setFormData({ ...formData, processingFee: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="total-outstanding">Total Outstanding (₹)</Label>
            <Input
              id="total-outstanding"
              type="text"
              value={totalOutstanding}
              disabled
              className="bg-muted font-semibold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Loan Description</Label>
            <Input
              id="description"
              type="text"
              placeholder="Enter loan description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Type</Label>
            <Select disabled={true}
              value={formData.interestType} 
              onValueChange={(value: 'daily' | 'monthly' | 'none') => setFormData({ ...formData, interestType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Interest</SelectItem>
                <SelectItem value="daily">Daily Interest</SelectItem>
                <SelectItem value="monthly">Monthly Interest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.interestType !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="interest-rate">Interest Rate (%)</Label>
              <Input
                id="interest-rate"
                type="number"
                step="0.01"
                placeholder="Enter interest rate"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="emi-amount">EMI Amount (₹)</Label>
            <Input
              id="emi-amount"
              type="number"
              step="0.01"
              placeholder="Enter EMI amount"
              value={formData.emiAmount}
              onChange={(e) => setFormData({ ...formData, emiAmount: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>EMI Frequency</Label>
            <Select 
              value={formData.emiFrequency} 
              onValueChange={(value: 'weekly' | 'monthly') => setFormData({ ...formData, emiFrequency: value })}
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

          <div className="space-y-2">
            <Label htmlFor="loan-date">Loan Date</Label>
            <Input
              id="loan-date"
              type="date"
              value={formData.loanDate}
              onChange={(e) => setFormData({ ...formData, loanDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">1st EMI Due Date </Label>
            <Input
              id="due-date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Loan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoanDialog;
