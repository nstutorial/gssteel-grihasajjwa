import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddCustomerDialogProps {
  onCustomerAdded?: () => void;
}

const AddCustomerDialog = ({ onCustomerAdded }: AddCustomerDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    payment_day: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate all required fields
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Customer name is required.",
      });
      return;
    }

    if (!formData.phone.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Phone number is required.",
      });
      return;
    }

    if (!formData.address.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Group Name is required.",
      });
      return;
    }

    if (!formData.payment_day) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Collection Day is required.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          payment_day: formData.payment_day,
        });

      if (error) throw error;

      toast({
        title: "Customer added",
        description: "The customer has been successfully added.",
      });

      setFormData({
        name: '',
        phone: '',
        address: '',
        payment_day: '',
      });
      
      setOpen(false);
      if (onCustomerAdded) onCustomerAdded();
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add customer. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter customer name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Group Name *</Label>
            <Textarea
              id="address"
              placeholder="Enter customer address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Collection Day *</Label>
            <Select 
              value={formData.payment_day} 
              onValueChange={(value: string) => setFormData({ ...formData, payment_day: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select collection day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="tuesday">Tuesday</SelectItem>
                <SelectItem value="wednesday">Wednesday</SelectItem>
                <SelectItem value="thursday">Thursday</SelectItem>
                <SelectItem value="friday">Friday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            * All fields are required
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Customer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;
