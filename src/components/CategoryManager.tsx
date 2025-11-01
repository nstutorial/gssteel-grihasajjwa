import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  FolderPlus 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useControl } from '@/contexts/ControlContext';
import CategoryDialog from './CategoryDialog';

interface Category {
  id: string;
  name: string;
  description?: string;
  type: 'income' | 'expense';
  created_at?: string;
  updated_at?: string;
}

interface CategoryManagerProps {
  onCategoryChange: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ onCategoryChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    if (open && user) {
      fetchCategories();
    }
  }, [open, user]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load categories. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTab = category.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    const confirmed = window.confirm(`Are you sure you want to delete the category "${category.name}"? This action cannot be undone and any expenses/earnings with this category will have their category removed.`);
    
    if (!confirmed) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Category deleted",
        description: `"${category.name}" has been successfully deleted.`,
      });

      fetchCategories();
      onCategoryChange();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        variant: "destructive",
        title: `"${category.name}" deleted`,
        description: "Failed to delete category. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryDialogClose = () => {
    setCategoryDialogOpen(false);
    setSelectedCategory(null);
    fetchCategories();
    onCategoryChange();
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setCategoryDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <FolderPlus className="h-4 w-4 mr-2" />
            Manage Categories
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Category Manager</DialogTitle>
            <DialogDescription>
              Manage your income and expense categories. Create, edit, and delete categories to organize your financial data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'expense' | 'income')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expense">Expense Categories</TabsTrigger>
                <TabsTrigger value="income">Income Categories</TabsTrigger>
              </TabsList>
              
              <TabsContent value="expense" className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            Loading categories...
                          </TableCell>
                        </TableRow>
                      ) : filteredCategories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? 'No categories match your search.' : 'No expense categories created yet.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{category.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {category.type}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {category.description || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {category.created_at ? new Date(category.created_at).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {controlSettings.allowEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCategory(category)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {controlSettings.allowDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCategory(category)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="income" className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            Loading categories...
                          </TableCell>
                        </TableRow>
                      ) : filteredCategories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? 'No categories match your search.' : 'No income categories created yet.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{category.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {category.type}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {category.description || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {category.created_at ? new Date(category.created_at).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {controlSettings.allowEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCategory(category)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {controlSettings.allowDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteCategory(category)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={selectedCategory}
        onCategoryChange={handleCategoryDialogClose}
        type={activeTab}
      />
    </>
  );
};

export default CategoryManager;

