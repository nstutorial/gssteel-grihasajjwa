import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useControl } from '@/contexts/ControlContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import EditEarningDialog from './EditEarningDialog';

interface Earning {
  id: string;
  amount: number;
  description: string;
  date: string;
  payment_method: 'cash' | 'bank';
  category_id: string | null;
  category: {
    name: string;
  } | null;
}

interface CategorySummary {
  category: string;
  total: number;
}

interface EarningsListProps {
  onRefresh?: () => void;
}

const EarningsList: React.FC<EarningsListProps> = ({ onRefresh }) => {
  const { user } = useAuth();
  const { settings: controlSettings } = useControl();
  const { toast } = useToast();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEarning, setSelectedEarning] = useState<Earning | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEarnings();
    }
  }, [user, onRefresh]);

  const fetchEarnings = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        category:expense_categories(name)
      `)
      .eq('user_id', user.id)
      .eq('type', 'earning')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching earnings:', error);
    } else {
      setEarnings(data || []);
    }
    setLoading(false);
  };

  const filteredEarnings = earnings.filter((earning) => {
    const matchesSearch =
      earning.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (earning.category?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const earningDate = new Date(earning.date);
    const matchesDateFrom = !dateFrom || earningDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || earningDate <= new Date(dateTo);

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const categorySummary: CategorySummary[] = filteredEarnings.reduce((acc, earning) => {
    const category = earning.category?.name || 'Uncategorized';
    const existing = acc.find((item) => item.category === category);
    if (existing) {
      existing.total += Number(earning.amount);
    } else {
      acc.push({ category, total: Number(earning.amount) });
    }
    return acc;
  }, [] as CategorySummary[]);

  const totalEarnings = filteredEarnings.reduce(
    (sum, earning) => sum + Number(earning.amount),
    0
  );

  const handleEditEarning = (earning: Earning) => {
    if (!controlSettings.allowEdit) return;
    setSelectedEarning(earning);
    setEditDialogOpen(true);
  };

  const handleQuickDelete = async (earning: Earning) => {
    if (!controlSettings.allowDelete || !user) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${earning.description}"? This action cannot be undone.`);
    if (!confirmed) return;

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

      fetchEarnings();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error deleting earning:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete earning. Please try again.",
      });
    }
  };

  const handleEarningUpdated = () => {
    fetchEarnings();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return <div>Loading earnings...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search earnings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          placeholder="From date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          placeholder="To date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categorySummary.map((item) => (
              <div key={item.category} className="flex justify-between items-center">
                <span className="text-sm">{item.category}</span>
                <span className="font-semibold text-green-600">₹{item.total.toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between items-center font-bold">
              <span>Total</span>
              <span className="text-green-600">₹{totalEarnings.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredEarnings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No earnings found
            </CardContent>
          </Card>
        ) : (
          filteredEarnings.map((earning) => (
            <Card key={earning.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{earning.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">₹{earning.amount.toFixed(2)}</span>
                    {(controlSettings.allowEdit || controlSettings.allowDelete) && (
                      <div className="flex gap-1">
                        {controlSettings.allowEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditEarning(earning)}
                            className="h-8 w-8 p-0"
                            title="Edit earning"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {controlSettings.allowDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuickDelete(earning)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete earning"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{earning.category?.name || 'Uncategorized'}</span>
                  <span>{format(new Date(earning.date), 'dd MMM yyyy')}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Payment: {earning.payment_method}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <EditEarningDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        earning={selectedEarning}
        onEarningUpdated={handleEarningUpdated}
      />
    </div>
  );
};

export default EarningsList;
