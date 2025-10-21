import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Calendar, IndianRupee, FileText } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { saveAs } from "file-saver";


interface Mahajan {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_amount: number;
  interest_rate: number | null;
  interest_type: string | null;
  bill_date: string;
  due_date: string | null;
  description: string | null;
  is_active: boolean | null;
}

interface BillTransaction {
  id: string;
  bill_id: string;
  amount: number;
  payment_date: string;
  transaction_type: string;
  payment_mode: 'cash' | 'bank';
  notes: string | null;
  bill: {
    bill_number: string;
    description: string | null;
  };
}

interface StatementEntry {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'bill_disbursement' | 'payment_paid' | 'interest_accrued';
}

interface MahajanStatementProps {
  mahajan: Mahajan;
}

const MahajanStatement: React.FC<MahajanStatementProps> = ({ mahajan }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [transactions, setTransactions] = useState<BillTransaction[]>([]);
  const [statement, setStatement] = useState<StatementEntry[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMahajanData();
    }
  }, [user, mahajan.id]);

  useEffect(() => {
    if (bills.length > 0) {
      generateStatement();
    }
  }, [bills, transactions, startDate, endDate]);

  const fetchMahajanData = async () => {
    try {
      setLoading(true);
      
      // Fetch bills
      const { data: billsData, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('mahajan_id', mahajan.id)
        .eq('user_id', user?.id)
        .order('bill_date', { ascending: false });

      if (billsError) throw billsError;

      let transactionsData: BillTransaction[] = [];

      // Fetch transactions (only if there are bills)
      if (billsData && billsData.length > 0) {
        const { data: transData, error: transactionsError } = await supabase
          .from('bill_transactions')
          .select(`
            *,
            bill:bills(bill_number, description)
          `)
          .in('bill_id', billsData.map(b => b.id))
          .order('payment_date', { ascending: true });

        if (transactionsError) throw transactionsError;
        transactionsData = transData || [];
      }

      // Update both states together after all data is fetched
      setTransactions(transactionsData);
      setBills(billsData || []);

    } catch (error) {
      console.error('Error fetching mahajan data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch mahajan data",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateStatement = () => {
    const statementEntries: StatementEntry[] = [];
    let runningBalance = 0;

    // Collect all entries first
    const allEntries: StatementEntry[] = [];

    // Add bill disbursements
    bills.forEach(bill => {
      const billDate = new Date(bill.bill_date);
      const isInRange = (!startDate || billDate >= new Date(startDate)) && 
                       (!endDate || billDate <= new Date(endDate));

      if (isInRange) {
        allEntries.push({
          date: bill.bill_date,
          description: `Bill - ${bill.description}`,
          reference: bill.bill_number,
          debit: bill.bill_amount,
          credit: 0,
          balance: 0, // Will be calculated after sorting
          type: 'bill_disbursement'
        });
      }
    });

    // Add payments paid
    transactions.forEach(transaction => {
      const paymentDate = new Date(transaction.payment_date);
      const isInRange = (!startDate || paymentDate >= new Date(startDate)) && 
                       (!endDate || paymentDate <= new Date(endDate));

      if (isInRange) {
        allEntries.push({
          date: transaction.payment_date,
          description: `Paid - ${transaction.bill.description || 'Bill'} (${transaction.bill.bill_number}) - ${transaction.transaction_type} via ${transaction.payment_mode}-${transaction.notes}`,
          reference: transaction.id,
          debit: 0,
          credit: transaction.amount,
          balance: 0, // Will be calculated after sorting
          type: 'payment_paid'
        });
      }
    });

    // Sort by date in ascending order
    allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance in chronological order
    allEntries.forEach(entry => {
      if (entry.type === 'bill_disbursement') {
        entry.balance = runningBalance + entry.debit;
        runningBalance += entry.debit;
      } else if (entry.type === 'payment_paid') {
        entry.balance = runningBalance - entry.credit;
        runningBalance -= entry.credit;
      }
      statementEntries.push(entry);
    });

    setStatement(statementEntries);
  };

  const calculateBillBalance = (billId: string) => {
    const billTransactions = transactions.filter(t => t.bill_id === billId);
    const totalPaid = billTransactions.reduce((sum, t) => sum + t.amount, 0);
    const bill = bills.find(b => b.id === billId);
    return bill ? bill.bill_amount - totalPaid : 0;
  };

  const calculateInterest = (bill: Bill, balance: number) => {
    if (!bill.interest_rate || bill.interest_type === 'none') return 0;
    
    const rate = bill.interest_rate / 100;
    const startDate = new Date(bill.bill_date);
    const endDate = new Date();
    
    if (bill.interest_type === 'daily') {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (bill.interest_type === 'monthly') {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30;
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateTotalOutstanding = () => {
    return bills.reduce((sum, bill) => {
      const balance = calculateBillBalance(bill.id);
      const interest = calculateInterest(bill, balance);
      return sum + balance + interest;
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF("p", "mm", "a4"); // Portrait, mm, A4
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const tableWidth = pageWidth - margin * 2;
  
      // ---------------- HEADER ----------------
      doc.setFontSize(16).setFont("helvetica", "bold");
      doc.text("Mahajan Statement", pageWidth / 2, 20, { align: "center" });
  
      doc.setFontSize(14);
      doc.text(mahajan.name, pageWidth / 2, 30, { align: "center" });
  
      doc.setLineWidth(0.5);
      doc.line(30, 35, pageWidth - 30, 35);
  
      let y = 45;
  
      // ---------------- MAHAJAN INFO ----------------
      doc.setFontSize(10).setFont("helvetica", "normal");
      doc.text(`Mahajan: ${mahajan.name}`, margin, y); y += 6;
      doc.text(`Phone: ${mahajan.phone || "N/A"}`, margin, y); y += 6;
      doc.text(`Address: ${mahajan.address || "N/A"}`, margin, y); y += 6;
      doc.text(
        `Statement Period: ${startDate ? format(new Date(startDate), "dd/MM/yyyy") : "All"} - ${endDate ? format(new Date(endDate), "dd/MM/yyyy") : "Current"}`,
        margin,
        y
      );
      y += 15;
  
      // ---------------- TABLE HEADERS ----------------
      doc.setFontSize(9).setFont("helvetica", "bold");
  
      const colWidths = [
        tableWidth * 0.15, // Date
        tableWidth * 0.25, // Description
        tableWidth * 0.10, // Ref
        tableWidth * 0.15, // Debit
        tableWidth * 0.15, // Credit
        tableWidth * 0.20, // Balance
      ];
  
      const drawTableHeader = (yPos: number) => {
        let colX = margin;
        const headers = ["Date", "Description", "Ref", "Debit", "Credit", "Balance"];
        headers.forEach((header, i) => {
          const align = i === 1 ? "left" : "center";
          const offset = i === 1 ? 2 : colWidths[i] / 2;
          doc.text(header, colX + offset, yPos, { align });
          colX += colWidths[i];
        });
  
        doc.setLineWidth(0.5);
        doc.rect(margin, yPos - 5, tableWidth, 8);
  
        colX = margin;
        for (let i = 0; i < colWidths.length - 1; i++) {
          colX += colWidths[i];
          doc.line(colX, yPos - 5, colX, yPos + 3);
        }
      };
  
      drawTableHeader(y);
      y += 2;
  
      // ---------------- TABLE ROWS ----------------
      doc.setFont("helvetica", "normal");
  
      statement.forEach((entry) => {
        const descLines = doc.splitTextToSize(entry.description, colWidths[1] - 4);
        const rowHeight = Math.max(8, descLines.length * 5 + 4);
  
        if (y + rowHeight > pageHeight - 30) {
          doc.addPage();
          y = 20;
          drawTableHeader(y);
          y += 8;
        }
  
        let colX = margin;
        const date = format(new Date(entry.date), "dd/MM/yyyy");
        const reference = entry.reference.length > 8 ? entry.reference.slice(0, 6) + "..." : entry.reference;
        const debitText = entry.debit > 0 ? formatCurrency(entry.debit).replace("₹", "") : "-";
        const creditText = entry.credit > 0 ? formatCurrency(entry.credit).replace("₹", "") : "-";
        const balanceText = formatCurrency(entry.balance).replace("₹", "");
  
        // Date
        doc.text(date, colX + colWidths[0] / 2, y + 4, { align: "center" });
        colX += colWidths[0];
  
        // Description
        descLines.forEach((line, i) => {
          doc.text(line, colX + 2, y + 4 + i * 5);
        });
        colX += colWidths[1];
  
        // Ref
        doc.text(reference, colX + colWidths[2] / 2, y + 4, { align: "center" });
        colX += colWidths[2];
  
        // Debit (red)
        doc.setTextColor(255, 0, 0);
        doc.text(debitText, colX + colWidths[3] / 2, y + 4, { align: "center" });
        colX += colWidths[3];
  
        // Credit (green)
        doc.setTextColor(0, 128, 0);
        doc.text(creditText, colX + colWidths[4] / 2, y + 4, { align: "center" });
        colX += colWidths[4];
  
        // Balance (black bold)
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(balanceText, colX + colWidths[5] / 2, y + 4, { align: "center" });
  
        // Reset font
        doc.setFont("helvetica", "normal");
  
        // Draw row borders
        colX = margin;
        for (let i = 0; i < colWidths.length; i++) {
          doc.rect(colX, y, colWidths[i], rowHeight);
          colX += colWidths[i];
        }
  
        y += rowHeight;
      });
  
      // ---------------- SUMMARY ----------------
      if (y + 30 > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      // Add top margin/padding before Account Summary
      y += 20;

      doc.setFontSize(12).setFont("helvetica", "bold");
      doc.text("Account Summary", margin, y); 
      y += 15;
  
      doc.setFillColor(249, 249, 249);
      doc.rect(margin, y - 5, tableWidth, 20, "F");
  
      doc.setFontSize(10).setFont("helvetica", "normal");
      doc.text(`Total Outstanding Balance: ${formatCurrency(calculateTotalOutstanding()).replace("₹", "")}`, margin + 5, y);
      y += 6;
      doc.text(`Total Transactions: ${statement.length}`, margin + 5, y);
  
      // ---------------- FOOTER ---------------- 
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
      }
  
      // ---------------- SAVE ----------------
      const pdfName = `mahajan-statement-${mahajan.name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      const pdfBlob = doc.output("blob");
      saveAs(pdfBlob, pdfName);
  
      toast({
        title: "PDF Downloaded",
        description: "Mahajan statement has been downloaded as PDF.",
      });
  
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF statement",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Statement Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Mahajan Statement</CardTitle>
            </div>
            <Button onClick={(e) => { e.preventDefault(); exportToPDF(); }} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="start-date">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{bills.length}</div>
              <div className="text-sm text-blue-600">Total Bills</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{transactions.length}</div>
              <div className="text-sm text-green-600">Total Payments</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(calculateTotalOutstanding())}</div>
              <div className="text-sm text-orange-600">Outstanding Balance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statement Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Statement</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading statement...</div>
          ) : statement.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-left p-3 font-medium">Reference</th>
                    <th className="text-right p-3 font-medium">Debit</th>
                    <th className="text-right p-3 font-medium">Credit</th>
                    <th className="text-right p-3 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((entry, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">{format(new Date(entry.date), 'dd/MM/yyyy')}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{entry.description}</span>
                          <Badge 
                            variant={
                              entry.type === 'bill_disbursement' ? 'destructive' :
                              entry.type === 'payment_paid' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {entry.type === 'bill_disbursement' ? 'Bill' :
                             entry.type === 'payment_paid' ? 'Payment' : 'Interest'}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600">{entry.reference}</td>
                      <td className="p-3 text-right">
                        {entry.credit > 0 ? (
                          <span className="text-red-600 font-medium">{formatCurrency(entry.credit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {entry.debit > 0 ? (
                          <span className="text-green-600 font-medium">{formatCurrency(entry.debit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(entry.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No transactions found for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MahajanStatement;
