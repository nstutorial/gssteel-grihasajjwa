import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useControl } from '@/contexts/ControlContext';

interface BillCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
}

interface EditBillCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: BillCustomer | null;
  onCustomerUpdated: () => void;
}

export function EditBillCustomerDialog({ open, onOpenChange, customer, onCustomerUpdated }: EditBillCustomerDialogProps) {
  const { settings: controlSettings } = useControl();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst_number: '',
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (customer && open) {
      setFormData({
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        gst_number: customer.gst_number || '',
      });
    }
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer) return;

    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const { error } = await supabase
      .from('bill_customers')
      .update({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        gst_number: formData.gst_number.trim() || null,
      })
      .eq('id', customer.id);

    if (error) {
      console.error('Error updating bill customer:', error);
      toast.error('Failed to update bill customer');
      return;
    }

    toast.success('Bill customer updated successfully');
    onCustomerUpdated();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!customer) return;

    // Check if customer has any bills
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id')
      .eq('mahajan_id', customer.id)
      .limit(1);

    if (billsError) {
      console.error('Error checking bills:', billsError);
      toast.error('Failed to check customer bills');
      return;
    }

    if (bills && bills.length > 0) {
      toast.error('Cannot delete customer with existing bills');
      setShowDeleteDialog(false);
      return;
    }

    const { error } = await supabase
      .from('bill_customers')
      .delete()
      .eq('id', customer.id);

    if (error) {
      console.error('Error deleting bill customer:', error);
      toast.error('Failed to delete bill customer');
      return;
    }

    toast.success('Bill customer deleted successfully');
    setShowDeleteDialog(false);
    onCustomerUpdated();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bill Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Customer Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter customer name"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>

            <div>
              <Label htmlFor="edit-gst">GST Number</Label>
              <Input
                id="edit-gst"
                value={formData.gst_number}
                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                placeholder="Enter GST number"
              />
            </div>

            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
                rows={3}
              />
            </div>

            <div className="flex justify-between">
              <div>
                {controlSettings.allowDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete Customer
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bill customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
