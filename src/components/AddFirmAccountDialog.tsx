import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AddFirmAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded: () => void;
}

export function AddFirmAccountDialog({ 
  open, 
  onOpenChange, 
  onAccountAdded 
}: AddFirmAccountDialogProps) {
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'bank' | 'cash'>('bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const balanceNum = parseFloat(openingBalance) || 0;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('firm_accounts')
        .insert({
          user_id: user.id,
          account_name: accountName,
          account_type: accountType,
          opening_balance: balanceNum,
          current_balance: balanceNum,
          account_number: accountNumber || null,
          bank_name: bankName || null,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Firm account created successfully');
      setAccountName('');
      setAccountType('bank');
      setOpeningBalance('');
      setAccountNumber('');
      setBankName('');
      onOpenChange(false);
      onAccountAdded();
    } catch (error: any) {
      console.error('Error creating firm account:', error);
      toast.error(error.message || 'Failed to create firm account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Firm Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="accountName">Account Name *</Label>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., Main Bank Account"
              required
            />
          </div>
          <div>
            <Label htmlFor="accountType">Account Type *</Label>
            <Select value={accountType} onValueChange={(value: 'bank' | 'cash') => setAccountType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {accountType === 'bank' && (
            <>
              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                />
              </div>
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Enter bank name"
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
