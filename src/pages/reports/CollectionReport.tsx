import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, FileSpreadsheet, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDownloader } from '@/lib/pdf-download';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string | null;
  loan_id: string;
  loans: {
    loan_number: string;
    customers: {
      name: string;
    };
  };
}

export default function CollectionReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, startDate, endDate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loans!inner(
            loan_number,
            user_id,
            customers(name)
          )
        `)
        .eq('loans.user_id', user?.id)
        .gte('payment_date', format(startDate, 'yyyy-MM-dd'))
        .lte('payment_date', format(endDate, 'yyyy-MM-dd'))
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load collection data');
    } finally {
      setLoading(false);
    }
  };

  const totalCollection = transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Collection Report', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Period: ${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`, 14, 25);
    doc.text(`Total Collection: ₹${totalCollection.toFixed(2)}`, 14, 32);
    
    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Customer', 'Loan #', 'Amount', 'Mode', 'Notes']],
      body: transactions.map(txn => [
        format(new Date(txn.payment_date), 'dd MMM yyyy'),
        txn.loans.customers.name,
        txn.loans.loan_number,
        `₹${txn.amount.toFixed(2)}`,
        txn.payment_mode,
        txn.notes || '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234] }
    });
    
    const pdfBlob = doc.output('blob');
    await PDFDownloader.downloadPDF(pdfBlob, `collection_report_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exported successfully');
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      transactions.map(txn => ({
        Date: format(new Date(txn.payment_date), 'dd MMM yyyy'),
        Customer: txn.loans.customers.name,
        'Loan Number': txn.loans.loan_number,
        Amount: txn.amount,
        'Payment Mode': txn.payment_mode,
        Notes: txn.notes || '-'
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Collection');
    XLSX.writeFile(wb, `collection_report_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exported successfully');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Collection Report</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(startDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1 space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(endDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Collection Details</CardTitle>
            <div className="text-2xl font-bold text-purple-600">
              Total: ₹{totalCollection.toFixed(2)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No collections found for the selected period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{format(new Date(txn.payment_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{txn.loans.customers.name}</TableCell>
                    <TableCell>{txn.loans.loan_number}</TableCell>
                    <TableCell className="text-right font-medium text-purple-600">
                      ₹{txn.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="capitalize">{txn.payment_mode}</TableCell>
                    <TableCell>{txn.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
