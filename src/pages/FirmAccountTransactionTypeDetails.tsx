import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  transaction_type: string;
  transaction_sub_type: string | null;
  amount: number;
  partner_id: string | null;
  mahajan_id: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface SubTypeSummary {
  subType: string;
  count: number;
  total: number;
}

export default function FirmAccountTransactionTypeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionType = searchParams.get('type');
  const selectedSubType = searchParams.get('subType');

  const [accountName, setAccountName] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subTypeSummary, setSubTypeSummary] = useState<SubTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [customTypes, setCustomTypes] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<Record<string, string>>({});
  const [mahajans, setMahajans] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id && transactionType) {
      fetchData();
    }
  }, [id, transactionType]);

  const fetchData = async () => {
    try {
      // Fetch account name
      const { data: accountData, error: accountError } = await supabase
        .from('firm_accounts')
        .select('account_name')
        .eq('id', id)
        .single();

      if (accountError) throw accountError;
      setAccountName(accountData.account_name);

      // Fetch transactions
      const { data: txnData, error: txnError } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('firm_account_id', id)
        .eq('transaction_type', transactionType)
        .order('transaction_date', { ascending: false });

      if (txnError) throw txnError;
      setTransactions(txnData || []);

      // Calculate sub-type summary
      const summary: Record<string, SubTypeSummary> = {};
      (txnData || []).forEach(txn => {
        const subTypeKey = txn.transaction_sub_type || 'none';
        if (!summary[subTypeKey]) {
          summary[subTypeKey] = { subType: subTypeKey, count: 0, total: 0 };
        }
        summary[subTypeKey].count++;
        summary[subTypeKey].total += txn.amount;
      });
      setSubTypeSummary(Object.values(summary));

      // Fetch custom types
      const { data: customTypesData } = await supabase
        .from('custom_transaction_types')
        .select('*');
      
      const typesMap: Record<string, string> = {};
      (customTypesData || []).forEach(type => {
        typesMap[type.id] = type.name;
      });
      setCustomTypes(typesMap);

      // Fetch partners
      const { data: partnersData } = await supabase
        .from('partners')
        .select('id, name');
      
      const partnersMap: Record<string, string> = {};
      (partnersData || []).forEach(partner => {
        partnersMap[partner.id] = partner.name;
      });
      setPartners(partnersMap);

      // Fetch mahajans
      const { data: mahajansData } = await supabase
        .from('mahajans')
        .select('id, name');
      
      const mahajansMap: Record<string, string> = {};
      (mahajansData || []).forEach(mahajan => {
        mahajansMap[mahajan.id] = mahajan.name;
      });
      setMahajans(mahajansMap);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      partner_deposit: 'Partner Deposit',
      partner_withdrawal: 'Partner Withdrawal',
      refund: 'Refund',
      expense: 'Expense',
      income: 'Income',
      adjustment: 'Adjustment',
      gst_tax_payment: 'GST Tax Payment',
      income_tax_payment: 'Income Tax Payment',
      paid_to_ca: 'Paid To CA',
      paid_to_supplier: 'Paid To Supplier'
    };
    
    if (labels[type]) return labels[type];
    if (customTypes[type]) return customTypes[type];
    
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getSubTransactionTypeLabel = (subType: string | null) => {
    if (!subType || subType === 'none') return 'No Sub-Type';
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(subType)) {
      return customTypes[subType] || 'Custom Type';
    }
    
    return getTransactionTypeLabel(subType);
  };

  const getTransactionDescription = (txn: Transaction) => {
    const parts: string[] = [];
    
    if (txn.partner_id && partners[txn.partner_id]) {
      parts.push(`Partner: ${partners[txn.partner_id]}`);
    }
    
    if (txn.mahajan_id && mahajans[txn.mahajan_id]) {
      parts.push(`Mahajan: ${mahajans[txn.mahajan_id]}`);
    }
    
    if (txn.description) {
      parts.push(`Notes: ${txn.description}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  const handleSubTypeClick = (subType: string) => {
    navigate(`/firm-accounts/${id}/type-details?type=${transactionType}&subType=${subType}`);
  };

  const filteredTransactions = selectedSubType
    ? transactions.filter(txn => (txn.transaction_sub_type || 'none') === selectedSubType)
    : transactions;

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/firm-accounts/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {getTransactionTypeLabel(transactionType || '')}
          </h1>
          <p className="text-muted-foreground">Account: {accountName}</p>
        </div>
      </div>

      {!selectedSubType && subTypeSummary.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Sub-Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subTypeSummary.map((summary) => (
              <Card 
                key={summary.subType} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleSubTypeClick(summary.subType)}
              >
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    {getSubTransactionTypeLabel(summary.subType)}
                  </div>
                  <div className="text-2xl font-bold">₹{summary.total.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {summary.count} transaction{summary.count !== 1 ? 's' : ''}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedSubType && (
        <div className="mb-4">
          <Button variant="outline" onClick={() => navigate(`/firm-accounts/${id}/type-details?type=${transactionType}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sub-Types
          </Button>
        </div>
      )}

      {selectedSubType && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-2">
              {getSubTransactionTypeLabel(selectedSubType)}
            </h2>
            <p className="text-muted-foreground">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!selectedSubType && <TableHead>Sub Type</TableHead>}
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                    </TableCell>
                    {!selectedSubType && (
                      <TableCell>
                        {getSubTransactionTypeLabel(txn.transaction_sub_type)}
                      </TableCell>
                    )}
                    <TableCell className="max-w-md truncate">
                      {getTransactionDescription(txn)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{txn.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={selectedSubType ? 2 : 3} className="text-right">Total:</TableCell>
                  <TableCell className="text-right">
                    ₹{filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
