import React, { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: string;
  name: string;
  description?: string;
  type: 'income' | 'expense';
  created_at?: string;
  updated_at?: string;
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  onCategoryChange: () => void;
  type: 'income' | 'expense';
}

const CategoryDialog: React.FC<CategoryDialogProps> = ({ 
  open, 
  onOpenChange, 
  category, 
  onCategoryChange, 
  type 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: type,
  });

  // Update form data when category prop changes
  React.useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        type: category.type || type,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        type: type,
      });
    }
  }, [category, type]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    setLoading(true);
    try {
      // Check for duplicate category names within the same type
      const { data: existingCategories, error: checkError } = await supabase
        .from('expense_categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('type', formData.type)
        .ilike('name', formData.name.trim());

      if (checkError) throw checkError;

      // Check if there's a duplicate (excluding the current category if updating)
      const duplicate = existingCategories?.find(
        (cat) => cat.name.toLowerCase() === formData.name.trim().toLowerCase() && 
        (!category || cat.id !== category.id)
      );

      if (duplicate) {
        toast({
          variant: "destructive",
          title: "Duplicate category",
          description: `A ${formData.type} category with this name already exists. Please choose a different name.`,
        });
        return;
      }

      if (category) {
        // Update existing category
        const { error } = await supabase
          .from('expense_categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            type: formData.type,
            updated_at: new Date().toISOString(),
          })
          .eq('id', category.id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: "Category updated",
          description: "Your category has been successfully updated.",
        });
      } else {
        // Create new category
        const { error } = await supabase
          .from('expense_categories')
          .insert({
            user_id: user.id,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            type: formData.type,
          });

        if (error) throw error;

        toast({
          title: "Category created",
          description: "Your new category has been successfully created.",
        });
      }

      onOpenChange(false);
      onCategoryChange();
    } catch (error: any) {
      console.error('Error saving category:', error);
      
      // Handle specific database constraint errors
      let errorMessage = category ? "Failed to update category. Please try again." : "Failed to create category. Please try again.";
      
      if (error.code === '23505') { // Unique constraint violation
        errorMessage = `A ${formData.type} category with this name already exists. Please choose a different name.`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !category) return;

    const confirmed = window.confirm('Are you sure you want to delete this category? This action cannot be undone.');
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Category deleted",
        description: "The category has been successfully deleted.",
      });

      onOpenChange(false);
      onCategoryChange();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete category. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit Category' : `Add New ${type === 'income' ? 'Income' : 'Expense'} Category`}
          </DialogTitle>
          <DialogDescription>
            {category 
              ? 'Update the category name, description, and type.' 
              : `Create a new ${type === 'income' ? 'income' : 'expense'} category to organize your transactions.`
            }
          </DialogDescription>
        </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Category Name</Label>
          <Input
            id="name"
            placeholder={`Enter ${type === 'income' ? 'income' : 'expense'} category name`}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Enter a description for this category"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>


        <div className="flex justify-between">
          <div>
            {category && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryDialog;
