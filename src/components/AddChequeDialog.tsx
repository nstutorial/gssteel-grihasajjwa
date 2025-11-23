import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'received' | 'issued';
  onSuccess: () => void;
}

export function AddChequeDialog({ open, onOpenChange, type, onSuccess }: AddChequeDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [mahajanId, setMahajanId] = useState('');
  const [firmAccountId, setFirmAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [mahajans, setMahajans] = useState<any[]>([]);
  const [firmAccounts, setFirmAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchMahajans();
      fetchFirmAccounts();
    }
  }, [open, user]);

  const fetchMahajans = async () => {
    const { data } = await supabase
      .from('mahajans')
      .select('id, name')
      .eq('user_id', user?.id)
      .order('name');
    
    if (data) setMahajans(data);
  };

  const fetchFirmAccounts = async () => {
    const { data } = await supabase
      .from('firm_accounts')
      .select('id, account_name, current_balance')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('account_name');
    
    if (data) setFirmAccounts(data);
  };

  const resetForm = () => {
    setChequeNumber('');
    setChequeDate(new Date());
    setAmount('');
    setBankName('');
    setPartyName('');
    setMahajanId('');
    setFirmAccountId('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chequeNumber || !amount || !bankName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (type === 'received' && !partyName && !firmAccountId) {
      toast.error('Please enter party name or select firm account');
      return;
    }

    if (type === 'issued' && !mahajanId) {
      toast.error('Please select a mahajan');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from('cheques').insert({
        user_id: user?.id,
        type,
        cheque_number: chequeNumber,
        cheque_date: format(chequeDate, 'yyyy-MM-dd'),
        amount: parseFloat(amount),
        bank_name: bankName,
        party_name: type === 'received' ? partyName : null,
        mahajan_id: mahajanId || null,
        firm_account_id: firmAccountId || null,
        notes,
        status: 'pending',
      });

      if (error) throw error;

      toast.success(`${type === 'received' ? 'Received' : 'Issued'} cheque added successfully`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error adding cheque: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Add {type === 'received' ? 'Received' : 'Issued'} Cheque</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-120px)] px-6">
          <form id="add-cheque-form" onSubmit={handleSubmit} className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="chequeNumber">Cheque Number *</Label>
              <Input
                id="chequeNumber"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Enter cheque number"
              />
            </div>

            <div className="space-y-2">
              <Label>Cheque Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !chequeDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {chequeDate ? format(chequeDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={chequeDate}
                    onSelect={(date) => date && setChequeDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name *</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Enter bank name"
              />
            </div>

            {type === 'received' && (
              <div className="space-y-2">
                <Label htmlFor="partyName">Party Name</Label>
                <Input
                  id="partyName"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Enter party name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Mahajan {type === 'issued' && '*'}</Label>
              <Select value={mahajanId} onValueChange={setMahajanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mahajan (optional)" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  {mahajans.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No mahajans found</div>
                  ) : (
                    mahajans.map((mahajan) => (
                      <SelectItem key={mahajan.id} value={mahajan.id}>
                        {mahajan.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Firm Account</Label>
              <Select value={firmAccountId} onValueChange={setFirmAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select firm account" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  {firmAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} (₹{account.current_balance.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any notes"
                rows={3}
              />
            </div>
          </form>
        </ScrollArea>

        <div className="flex gap-2 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="add-cheque-form" disabled={loading} className="flex-1">
            {loading ? 'Adding...' : 'Add Cheque'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
