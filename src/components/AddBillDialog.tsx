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

interface Mahajan {
  id: string;
  name: string;
}

interface AddBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mahajan?: Mahajan | null;
  onBillAdded: () => void;
}

const AddBillDialog: React.FC<AddBillDialogProps> = ({ open, onOpenChange, mahajan, onBillAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mahajans, setMahajans] = useState<Mahajan[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    mahajanId: '',
    billAmount: '',
    description: '',
    interestRate: '',
    interestType: 'none' as 'daily' | 'monthly' | 'none',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
  });

  useEffect(() => {
    if (user && open) {
      fetchMahajans();
    }
  }, [user, open]);

  useEffect(() => {
    if (mahajan && open) {
      setFormData(prev => ({ ...prev, mahajanId: mahajan.id }));
    }
  }, [mahajan, open]);

  const fetchMahajans = async () => {
    try {
      const { data, error } = await supabase
        .from('mahajans')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name');

      if (error) throw error;
      setMahajans(data || []);
    } catch (error) {
      console.error('Error fetching mahajans:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const mahajanId = mahajan?.id || formData.mahajanId;

    if (!mahajanId) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a mahajan.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bills')
        .insert({
          user_id: user.id,
          mahajan_id: mahajanId,
          bill_amount: parseFloat(formData.billAmount),
          description: formData.description,
          interest_rate: formData.interestType === 'none' ? 0 : parseFloat(formData.interestRate),
          interest_type: formData.interestType,
          bill_date: formData.billDate,
          due_date: formData.dueDate || null,
        });

      if (error) throw error;

      toast({
        title: "Bill added",
        description: "The bill has been successfully added.",
      });

      setFormData({
        mahajanId: mahajan?.id || '',
        billAmount: '',
        description: '',
        interestRate: '',
        interestType: 'none',
        billDate: new Date().toISOString().split('T')[0],
        dueDate: '',
      });
      
      onOpenChange(false);
      onBillAdded();
    } catch (error) {
      console.error('Error adding bill:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add bill. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Bill</DialogTitle>
        </DialogHeader>
        <form 
          onSubmit={handleSubmit} 
          className="space-y-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="mahajan">Mahajan *</Label>
            {mahajan ? (
              <div className="p-3 border rounded-md bg-gray-50">
                <div className="text-sm font-medium">{mahajan.name}</div>                
              </div>
            ) : (
              <Select 
                value={formData.mahajanId} 
                onValueChange={(value) => setFormData({ ...formData, mahajanId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mahajan" />
                </SelectTrigger>
                <SelectContent>
                  {mahajans.map((mahajan) => (
                    <SelectItem key={mahajan.id} value={mahajan.id}>
                      {mahajan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="billAmount">Bill Amount *</Label>
            <Input
              id="billAmount"
              type="number"
              step="0.01"
              placeholder="Enter bill amount"
              value={formData.billAmount}
              onChange={(e) => setFormData({ ...formData, billAmount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              type="text"
              placeholder="Enter bill description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Type</Label>
            <Select 
              value={formData.interestType} 
              onValueChange={(value: 'daily' | 'monthly' | 'none') => 
                setFormData({ ...formData, interestType: value })
              }
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
              <Label htmlFor="interestRate">Interest Rate (%) *</Label>
              <Input
                id="interestRate"
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
            <Label htmlFor="billDate">Bill Date *</Label>
            <Input
              id="billDate"
              type="date"
              value={formData.billDate}
              onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            * Required fields
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : 'Add Bill'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddBillDialog;
