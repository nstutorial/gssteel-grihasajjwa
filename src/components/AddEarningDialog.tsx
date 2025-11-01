import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import CategoryManager from './CategoryManager';

interface Category {
  id: string;
  name: string;
}

interface AddEarningDialogProps {
  onEarningAdded: () => void;
  onCategoryChange?: () => void;
}

const AddEarningDialog: React.FC<AddEarningDialogProps> = ({ onEarningAdded, onCategoryChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    categoryId: '',
    paymentMethod: 'cash' as 'cash' | 'bank',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

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
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          amount: parseFloat(formData.amount),
          description: formData.description,
          category_id: formData.categoryId || null,
          payment_method: formData.paymentMethod,
          date: formData.date,
          type: 'earning',
        });

      if (error) throw error;

      toast({
        title: "Earning added",
        description: "Your earning has been successfully recorded.",
      });

      setFormData({
        amount: '',
        description: '',
        categoryId: '',
        paymentMethod: 'cash',
        date: new Date().toISOString().split('T')[0],
      });
      
      setOpen(false);
      onEarningAdded();
      if (onCategoryChange) onCategoryChange();
    } catch (error) {
      console.error('Error adding earning:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add earning. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs sm:text-sm">
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Add Earning</span>
          <span className="sm:hidden">Add Earn</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Earning</DialogTitle>
          <DialogDescription>
            Record a new income transaction with amount, category, and payment method details.
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
            <div className="flex justify-between items-center">
              <Label>Category</Label>
              <CategoryManager onCategoryChange={fetchCategories} />
            </div>
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Earning'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEarningDialog;
