import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useControl } from '@/contexts/ControlContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Earning {
  id: string;
  amount: number;
  description: string;
  date: string;
  payment_method: 'cash' | 'bank';
  category_id: string | null;
  category?: {
    name: string;
  } | null;
}

interface EditEarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earning: Earning | null;
  onEarningUpdated: () => void;
}

const EditEarningDialog: React.FC<EditEarningDialogProps> = ({
  open,
  onOpenChange,
  earning,
  onEarningUpdated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    categoryId: '',
    paymentMethod: 'cash' as 'cash' | 'bank',
    date: '',
  });

  useEffect(() => {
    if (open && user) {
      fetchCategories();
    }
  }, [open, user]);

  useEffect(() => {
    if (open && earning) {
      setFormData({
        amount: earning.amount.toString(),
        description: earning.description,
        categoryId: earning.category_id || '',
        paymentMethod: earning.payment_method,
        date: earning.date,
      });
    }
  }, [open, earning]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('type', 'income')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !earning) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parseFloat(formData.amount),
          description: formData.description.trim(),
          category_id: formData.categoryId || null,
          payment_method: formData.paymentMethod,
          date: formData.date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', earning.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Earning updated",
        description: "Your earning has been successfully updated.",
      });

      onEarningUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating earning:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update earning. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !earning) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${earning.description}"? This action cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', earning.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Earning deleted",
        description: "The earning has been successfully deleted.",
      });

      onOpenChange(false);
      onEarningUpdated();
    } catch (error: any) {
      console.error('Error deleting earning:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete earning. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Earning</DialogTitle>
          <DialogDescription>
            Update the earning transaction details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What did you earn from?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select 
              value={formData.paymentMethod} 
              onValueChange={(value: 'cash' | 'bank') => setFormData({ ...formData, paymentMethod: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Updating...' : 'Update Earning'}
            </Button>
            {controlSettings.allowDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={loading}
                title="Delete earning"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEarningDialog;
