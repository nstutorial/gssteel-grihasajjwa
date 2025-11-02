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

interface Sale {
  id: string;
  sale_number: string;
  sale_amount: number;
  sale_date: string;
  interest_rate: number;
  description: string | null;
  bill_customers: {
    name: string;
  };
}

export default function SalesReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) {
      fetchSales();
    }
  }, [user, startDate, endDate]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          bill_customers(name)
        `)
        .eq('user_id', user?.id)
        .gte('sale_date', format(startDate, 'yyyy-MM-dd'))
        .lte('sale_date', format(endDate, 'yyyy-MM-dd'))
        .order('sale_date', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.sale_amount), 0);

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Sales Report', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Period: ${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`, 14, 25);
    doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`, 14, 32);
    
    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Customer', 'Sale #', 'Amount', 'Interest', 'Description']],
      body: sales.map(sale => [
        format(new Date(sale.sale_date), 'dd MMM yyyy'),
        sale.bill_customers.name,
        sale.sale_number,
        `₹${sale.sale_amount.toFixed(2)}`,
        `${sale.interest_rate}%`,
        sale.description || '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] }
    });
    
    const pdfBlob = doc.output('blob');
    await PDFDownloader.downloadPDF(pdfBlob, `sales_report_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF exported successfully');
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      sales.map(sale => ({
        Date: format(new Date(sale.sale_date), 'dd MMM yyyy'),
        Customer: sale.bill_customers.name,
        'Sale Number': sale.sale_number,
        Amount: sale.sale_amount,
        'Interest Rate': sale.interest_rate,
        Description: sale.description || '-'
      }))
    );
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `sales_report_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel exported successfully');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Sales Report</h1>
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
            <CardTitle>Sales Details</CardTitle>
            <div className="text-2xl font-bold text-green-600">
              Total: ₹{totalSales.toFixed(2)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales found for the selected period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Sale Number</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{format(new Date(sale.sale_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{sale.bill_customers.name}</TableCell>
                    <TableCell>{sale.sale_number}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      ₹{sale.sale_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{sale.interest_rate}%</TableCell>
                    <TableCell>{sale.description || '-'}</TableCell>
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
