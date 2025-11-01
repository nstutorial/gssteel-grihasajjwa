import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddPartnerDialog } from '@/components/AddPartnerDialog';
import { PartnersList } from '@/components/PartnersList';

interface Partner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_invested: number;
  balance: number; // ✅ added
}

export default function Partners() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('name');

    if (error) throw error;

    const partnersWithStats = await Promise.all(
      (data || []).map(async (partner) => {
        // Fetch all partner-related transactions
        const { data: partnerTxns } = await supabase
          .from('partner_transactions')
          .select('amount')
          .eq('partner_id', partner.id);

        // Fetch firm-related partner deposits/withdrawals
        const { data: firmTxns } = await supabase
          .from('firm_transactions')
          .select('amount, transaction_type')
          .eq('partner_id', partner.id);

        // Combine all transactions
        const allTxns = [...(partnerTxns || []), ...(firmTxns || [])];

        // ✅ Compute totals dynamically
        let total_invested = 0;
        let total_withdrawn = 0;

        allTxns.forEach((txn) => {
          if (txn.amount > 0) total_invested += txn.amount;
          else total_withdrawn += Math.abs(txn.amount);
        });

        // ✅ True balance can be negative if withdrawals > investments
        const balance = total_invested - total_withdrawn;

        return {
          ...partner,
          total_invested,
          balance,
        };
      })
    );

    setPartners(partnersWithStats);
  } catch (error: any) {
    console.error('Error fetching partners:', error);
    toast.error('Failed to load partners');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="container mx-auto p-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Partners / Investors</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <PartnersList partners={partners} />
      )}

      <AddPartnerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onPartnerAdded={fetchPartners}
      />
    </div>
  );
}
