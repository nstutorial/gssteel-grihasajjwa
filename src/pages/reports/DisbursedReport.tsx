import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

interface Loan {
  id: string;
  loan_number: string;
  principal_amount: number;
  interest_rate: number;
  loan_date: string;
  due_date: string | null;
  customers: {
    name: string;
  };
}

export default function DisbursedReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user, startDate, endDate]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          customers(name)
        `)
        .eq('user_id', user?.id)
        .gte('loan_date', format(startDate, 'yyyy-MM-dd'))
        .lte('loan_date', format(endDate, 'yyyy-MM-dd'))
        .order('loan_date', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to load disbursed loans');
    } finally {
      setLoading(false);
    }
  };

  const totalDisbursed = loans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Disbursed Loans Report', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Period: ${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`, 14, 25);
    doc.text(`Total Disbursed: ₹${totalDisbursed.toFixed(2)}`, 14, 32);
    
    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Customer', 'Loan #', 'Amount', 'Interest', 'Due Date']],
      body: loans.map(loan => [
        format(new Date(loan.loan_date), 'dd MMM yyyy'),
        loan.customers.name,
        loan.loan_number,
        `₹${loan.principal_amount.toFixed(2)}`,
        `${loan.interest_rate}%`,
        loan.due_date ? format(new Date(loan.due_date), 'dd MMM yyyy') : '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] }
    });
    
    const pdfBlob = doc.output('blob');
    await PDFDownloader.downloadPDF(pdfBlob, `disbursed_report_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exported successfully');
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      loans.map(loan => ({
        Date: format(new Date(loan.loan_date), 'dd MMM yyyy'),
        Customer: loan.customers.name,
        'Loan Number': loan.loan_number,
        Amount: loan.principal_amount,
        'Interest Rate': loan.interest_rate,
        'Due Date': loan.due_date ? format(new Date(loan.due_date), 'dd MMM yyyy') : '-'
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Disbursed');
    XLSX.writeFile(wb, `disbursed_report_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exported successfully');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Disbursed Loans Report</h1>
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
            <CardTitle>Disbursed Loans</CardTitle>
            <div className="text-2xl font-bold text-indigo-600">
              Total: ₹{totalDisbursed.toFixed(2)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : loans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No disbursed loans found for the selected period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>{format(new Date(loan.loan_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{loan.customers.name}</TableCell>
                    <TableCell>{loan.loan_number}</TableCell>
                    <TableCell className="text-right font-medium text-indigo-600">
                      ₹{loan.principal_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{loan.interest_rate}%</TableCell>
                    <TableCell>
                      {loan.due_date ? format(new Date(loan.due_date), 'dd MMM yyyy') : '-'}
                    </TableCell>
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
