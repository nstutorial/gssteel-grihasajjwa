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
import { Edit, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
  locked?: boolean;
}

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onCustomerUpdated: () => void;
}

const EditCustomerDialog: React.FC<EditCustomerDialogProps> = ({
  open,
  onOpenChange,
  customer,
  onCustomerUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    payment_day: 'monday' as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  });

  useEffect(() => {
    if (open && user && customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        payment_day: customer.payment_day as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' || 'monday',
      });
    }
  }, [open, user, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !customer) return;

    if (customer.locked) {
      toast({
        variant: "destructive",
        title: "Cannot edit customer",
        description: "This customer is locked. Unlock it first to edit.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          payment_day: formData.payment_day,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer updated successfully!",
      });

      onCustomerUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update customer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !customer) return;
    
    if (customer.locked) {
      toast({
        variant: "destructive",
        title: "Cannot delete customer",
        description: "This customer is locked. Unlock it first to delete.",
      });
      return;
    }

    try {
      // Check if customer has active loans or transactions
      const { data: loanData } = await supabase
        .from('loans')
        .select('id, is_active')
        .eq('customer_id', customer.id);

      const hasActiveLoans = loanData?.some(loan => loan.is_active);
      
      if (hasActiveLoans) {
        toast({
          variant: "destructive",
          title: "Cannot delete customer",
          description: "Customer has active loans. Complete all loans before deleting.",
        });
        return;
      }

      // Check if customer has any transactions
      const { data: transactions } = await supabase
        .from('loan_transactions')
        .select('id, loan:loans!inner(customer_id)')
        .eq('loan.customer_id', customer.id);

      if (transactions && transactions.length > 0) {
        toast({
          variant: "destructive",
          title: "Cannot delete customer",
          description: "Customer has transaction history. Cannot delete customer with transactions.",
        });
        return;
      }

      if (!confirm(`Are you sure you want to delete customer "${customer.name}"? This action cannot be undone.`)) return;

      setLoading(true);
      
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully!",
      });

      onCustomerUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer information including name, contact details, and payment preferences.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              placeholder="Enter customer name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Enter customer address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_day">Preferred Payment Day</Label>
            <Select
              value={formData.payment_day}
              onValueChange={(value: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday') =>
                setFormData({ ...formData, payment_day: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="tuesday">Tuesday</SelectItem>
                <SelectItem value="wednesday">Wednesday</SelectItem>
                <SelectItem value="thursday">Thursday</SelectItem>
                <SelectItem value="friday">Friday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
              </SelectContent>
            </Select>
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

export default EditCustomerDialog;
