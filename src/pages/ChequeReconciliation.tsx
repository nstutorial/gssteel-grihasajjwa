import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ArrowLeft, CalendarIcon, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/LoadingSpinner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClearedCheque {
  id: string;
  cheque_number: string;
  cheque_date: string;
  cleared_date: string;
  amount: number;
  bank_name: string;
  type: string;
  party_name: string | null;
  mahajan_name: string | null;
  firm_account_name: string | null;
  bank_transaction_id: string | null;
}

interface BankSummary {
  bank_name: string;
  total_amount: number;
  cheque_count: number;
  received_count: number;
  issued_count: number;
  received_amount: number;
  issued_amount: number;
}

const ChequeReconciliation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [cheques, setCheques] = useState<ClearedCheque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchClearedCheques();
    }
  }, [user, startDate, endDate]);

  const fetchClearedCheques = async () => {
    try {
      setLoading(true);
      
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      const { data: cheques, error: chequesError } = await supabase
        .from('cheques')
        .select(`
          id,
          cheque_number,
          cheque_date,
          cleared_date,
          amount,
          bank_name,
          type,
          party_name,
          bank_transaction_id,
          mahajan_id,
          firm_account_id,
          mahajans (
            name
          ),
          firm_accounts (
            account_name
          )
        `)
        .eq('user_id', user?.id)
        .eq('status', 'cleared')
        .gte('cleared_date', startDateStr)
        .lte('cleared_date', endDateStr)
        .order('cleared_date', { ascending: true });

      if (chequesError) throw chequesError;

      const chequesData: ClearedCheque[] = (cheques || []).map(cheque => ({
        id: cheque.id,
        cheque_number: cheque.cheque_number,
        cheque_date: cheque.cheque_date,
        cleared_date: cheque.cleared_date || '',
        amount: parseFloat(cheque.amount.toString()),
        bank_name: cheque.bank_name,
        type: cheque.type,
        party_name: cheque.party_name,
        mahajan_name: cheque.mahajans?.name || null,
        firm_account_name: cheque.firm_accounts?.account_name || null,
        bank_transaction_id: cheque.bank_transaction_id,
      }));

      setCheques(chequesData);
    } catch (error) {
      console.error('Error fetching cleared cheques:', error);
      toast.error('Failed to load cleared cheques');
    } finally {
      setLoading(false);
    }
  };

  const getBankSummaries = (): BankSummary[] => {
    const bankMap = new Map<string, BankSummary>();

    cheques.forEach(cheque => {
      if (!bankMap.has(cheque.bank_name)) {
        bankMap.set(cheque.bank_name, {
          bank_name: cheque.bank_name,
          total_amount: 0,
          cheque_count: 0,
          received_count: 0,
          issued_count: 0,
          received_amount: 0,
          issued_amount: 0,
        });
      }

      const summary = bankMap.get(cheque.bank_name)!;
      summary.total_amount += cheque.amount;
      summary.cheque_count += 1;

      if (cheque.type === 'received') {
        summary.received_count += 1;
        summary.received_amount += cheque.amount;
      } else {
        summary.issued_count += 1;
        summary.issued_amount += cheque.amount;
      }
    });

    return Array.from(bankMap.values()).sort((a, b) => b.total_amount - a.total_amount);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Cheque Reconciliation Report', 14, 20);
    
    // Date range
    doc.setFontSize(10);
    doc.text(
      `Period: ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`,
      14,
      28
    );
    
    // Summary
    const totalReceived = cheques.filter(c => c.type === 'received').reduce((sum, c) => sum + c.amount, 0);
    const totalIssued = cheques.filter(c => c.type === 'issued').reduce((sum, c) => sum + c.amount, 0);
    
    doc.text(`Total Cleared Cheques: ${cheques.length}`, 14, 36);
    doc.text(`Total Received: ₹${totalReceived.toLocaleString()}`, 14, 42);
    doc.text(`Total Issued: ₹${totalIssued.toLocaleString()}`, 14, 48);
    doc.text(`Net Position: ₹${(totalReceived - totalIssued).toLocaleString()}`, 14, 54);

    // Bank-wise summary
    const bankSummaries = getBankSummaries();
    doc.setFontSize(14);
    doc.text('Bank-wise Summary', 14, 64);
    
    autoTable(doc, {
      startY: 68,
      head: [['Bank', 'Count', 'Received', 'Issued', 'Total']],
      body: bankSummaries.map(bank => [
        bank.bank_name,
        bank.cheque_count.toString(),
        `₹${bank.received_amount.toLocaleString()}`,
        `₹${bank.issued_amount.toLocaleString()}`,
        `₹${bank.total_amount.toLocaleString()}`,
      ]),
      theme: 'grid',
    });

    // Detailed cheques
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Detailed Cheque List', 14, 20);
    
    autoTable(doc, {
      startY: 26,
      head: [['Cheque No', 'Date', 'Cleared', 'Type', 'Bank', 'Amount', 'Party/Mahajan']],
      body: cheques.map(cheque => [
        cheque.cheque_number,
        format(new Date(cheque.cheque_date), 'dd/MM/yy'),
        format(new Date(cheque.cleared_date), 'dd/MM/yy'),
        cheque.type === 'received' ? 'Rcvd' : 'Issued',
        cheque.bank_name,
        `₹${cheque.amount.toLocaleString()}`,
        cheque.party_name || cheque.mahajan_name || '-',
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
    });

    doc.save(`cheque-reconciliation-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Report exported successfully');
  };

  const bankSummaries = getBankSummaries();
  const totalReceived = cheques.filter(c => c.type === 'received').reduce((sum, c) => sum + c.amount, 0);
  const totalIssued = cheques.filter(c => c.type === 'issued').reduce((sum, c) => sum + c.amount, 0);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar 
          onSettingsClick={() => navigate('/settings')}
          onProfileClick={() => navigate('/profile')}
        />
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/cheques')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Cheque Reconciliation</h1>
                  <p className="text-muted-foreground">Bank-wise cleared cheques report</p>
                </div>
              </div>
              <Button onClick={exportToPDF}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Date Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(startDate, 'dd MMM yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(endDate, 'dd MMM yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cheques</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cheques.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Received</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">₹{totalReceived.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {cheques.filter(c => c.type === 'received').length} cheques
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Issued</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">₹{totalIssued.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {cheques.filter(c => c.type === 'issued').length} cheques
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Position</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", totalReceived >= totalIssued ? "text-green-600" : "text-red-600")}>
                    ₹{(totalReceived - totalIssued).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bank-wise Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {bankSummaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cleared cheques in selected date range
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bank Name</TableHead>
                          <TableHead className="text-right">Total Cheques</TableHead>
                          <TableHead className="text-right">Received (Count)</TableHead>
                          <TableHead className="text-right">Received (Amount)</TableHead>
                          <TableHead className="text-right">Issued (Count)</TableHead>
                          <TableHead className="text-right">Issued (Amount)</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bankSummaries.map((bank) => (
                          <TableRow key={bank.bank_name}>
                            <TableCell className="font-medium">{bank.bank_name}</TableCell>
                            <TableCell className="text-right">{bank.cheque_count}</TableCell>
                            <TableCell className="text-right">{bank.received_count}</TableCell>
                            <TableCell className="text-right text-green-600">
                              ₹{bank.received_amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">{bank.issued_count}</TableCell>
                            <TableCell className="text-right text-red-600">
                              ₹{bank.issued_amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{bank.total_amount.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{cheques.length}</TableCell>
                          <TableCell className="text-right">
                            {cheques.filter(c => c.type === 'received').length}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            ₹{totalReceived.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {cheques.filter(c => c.type === 'issued').length}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            ₹{totalIssued.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{(totalReceived + totalIssued).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Cheque List</CardTitle>
              </CardHeader>
              <CardContent>
                {cheques.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cleared cheques in selected date range
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cheque No</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Cheque Date</TableHead>
                          <TableHead>Cleared Date</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead>Party/Mahajan</TableHead>
                          <TableHead>Firm Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Transaction ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cheques.map((cheque) => (
                          <TableRow key={cheque.id}>
                            <TableCell className="font-medium">{cheque.cheque_number}</TableCell>
                            <TableCell>
                              <span className={cheque.type === 'received' ? 'text-green-600' : 'text-red-600'}>
                                {cheque.type === 'received' ? 'Received' : 'Issued'}
                              </span>
                            </TableCell>
                            <TableCell>{format(new Date(cheque.cheque_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{format(new Date(cheque.cleared_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{cheque.bank_name}</TableCell>
                            <TableCell>{cheque.party_name || cheque.mahajan_name || '-'}</TableCell>
                            <TableCell>{cheque.firm_account_name || '-'}</TableCell>
                            <TableCell className="text-right">₹{cheque.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {cheque.bank_transaction_id || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ChequeReconciliation;
