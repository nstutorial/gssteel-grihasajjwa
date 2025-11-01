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

interface Mahajan {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
}

interface EditMahajanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mahajan: Mahajan | null;
  onMahajanUpdated: () => void;
}

const EditMahajanDialog: React.FC<EditMahajanDialogProps> = ({
  open,
  onOpenChange,
  mahajan,
  onMahajanUpdated,
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
    if (open && user && mahajan) {
      setFormData({
        name: mahajan.name || '',
        phone: mahajan.phone || '',
        address: mahajan.address || '',
        payment_day: mahajan.payment_day as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' || 'monday',
      });
    }
  }, [open, user, mahajan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mahajan) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('mahajans')
        .update({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          payment_day: formData.payment_day,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mahajan.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mahajan updated successfully!",
      });

      onMahajanUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating mahajan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update mahajan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !mahajan) return;
    
    try {
      const { error } = await supabase
        .from('mahajans')
        .delete()
        .eq('id', mahajan.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mahajan deleted successfully!",
      });

      onMahajanUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting mahajan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete mahajan.",
        variant: "destructive",
      });
    }
  };

  if (!mahajan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Mahajan
          </DialogTitle>
          <DialogDescription>
            Update mahajan information below.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter mahajan name"
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
            <Label htmlFor="address">Group Name</Label>
            <Textarea
              id="address"
              placeholder="Enter mahajan address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Collection Day</Label>
            <Select 
              value={formData.payment_day} 
              onValueChange={(value: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday') => 
                setFormData({ ...formData, payment_day: value })
              }
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

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Updating...' : 'Update Mahajan'}
            </Button>
            {controlSettings.allowMahajanDeletion && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="px-3"
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

export default EditMahajanDialog;
