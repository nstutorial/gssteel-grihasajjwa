import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDownloader } from '@/lib/pdf-download';
import * as XLSX from 'xlsx';

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

export default function ActiveLoansReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

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
        .eq('is_active', true)
        .order('loan_date', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to load active loans');
    } finally {
      setLoading(false);
    }
  };

  const totalPrincipal = loans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Active Loans Report', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Total Active Loans: ${loans.length}`, 14, 25);
    doc.text(`Total Principal: ₹${totalPrincipal.toFixed(2)}`, 14, 32);
    
    autoTable(doc, {
      startY: 40,
      head: [['Loan Date', 'Customer', 'Loan #', 'Amount', 'Interest', 'Due Date']],
      body: loans.map(loan => [
        format(new Date(loan.loan_date), 'dd MMM yyyy'),
        loan.customers.name,
        loan.loan_number,
        `₹${loan.principal_amount.toFixed(2)}`,
        `${loan.interest_rate}%`,
        loan.due_date ? format(new Date(loan.due_date), 'dd MMM yyyy') : '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    const pdfBlob = doc.output('blob');
    await PDFDownloader.downloadPDF(pdfBlob, `active_loans_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exported successfully');
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      loans.map(loan => ({
        'Loan Date': format(new Date(loan.loan_date), 'dd MMM yyyy'),
        Customer: loan.customers.name,
        'Loan Number': loan.loan_number,
        Amount: loan.principal_amount,
        'Interest Rate': loan.interest_rate,
        'Due Date': loan.due_date ? format(new Date(loan.due_date), 'dd MMM yyyy') : '-'
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Active Loans');
    XLSX.writeFile(wb, `active_loans_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exported successfully');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Active Loans Report</h1>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Loans ({loans.length})</CardTitle>
            <div className="text-2xl font-bold text-primary">
              Total: ₹{totalPrincipal.toFixed(2)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : loans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active loans found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Date</TableHead>
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
                    <TableCell className="text-right font-medium text-primary">
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
