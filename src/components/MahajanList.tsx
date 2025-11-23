import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Trash2, MapPin, Eye, Calendar, Edit, Plus, ChevronLeft, ChevronRight, Info, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useControl } from '@/contexts/ControlContext';
import MahajanDetails from './MahajanDetails';
import EditMahajanDialog from './EditMahajanDialog';
import AddBillDialog from './AddBillDialog';
import { AdvancePaymentDetailsDialog } from './AdvancePaymentDetailsDialog';
import { RecordMahajanPaymentDialog } from './RecordMahajanPaymentDialog';

interface Mahajan {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
  advance_payment?: number;
  bills?: Array<{
    id: string;
    bill_amount: number;
    is_active: boolean;
    interest_rate?: number;
    interest_type?: string;
    bill_date?: string;
  }>;
}

interface MahajanListProps {
  onUpdate?: () => void;
}

const MahajanList = ({ onUpdate }: MahajanListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [mahajans, setMahajans] = useState<Mahajan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMahajan, setSelectedMahajan] = useState<Mahajan | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mahajanToEdit, setMahajanToEdit] = useState<Mahajan | null>(null);
  const [addBillDialogOpen, setAddBillDialogOpen] = useState(false);
  const [mahajanForBill, setMahajanForBill] = useState<Mahajan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [firmTransactions, setFirmTransactions] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [advanceDetailsOpen, setAdvanceDetailsOpen] = useState(false);
  const [selectedMahajanForAdvance, setSelectedMahajanForAdvance] = useState<Mahajan | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedMahajanForPayment, setSelectedMahajanForPayment] = useState<Mahajan | null>(null);

  // Table view is default
  const [showTableView, setShowTableView] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMahajans();
    }
  }, [user]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchMahajans();
      if (onUpdate) onUpdate();
    };

    window.addEventListener('refresh-mahajans', handleRefresh);
    return () => window.removeEventListener('refresh-mahajans', handleRefresh);
  }, [onUpdate]);

  const fetchMahajans = async () => {
    try {
      const { data, error } = await supabase
        .from('mahajans')
        .select(`
          *,
          bills (id, bill_amount, is_active, interest_rate, interest_type, bill_date)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch all transactions for calculating outstanding balances
      let transData: any[] = [];
      let firmTransData: any[] = [];
      if (data && data.length > 0) {
        const billIds = data.flatMap(m => m.bills?.map(b => b.id) || []);
        if (billIds.length > 0) {
          const { data: transactions } = await supabase
            .from('bill_transactions')
            .select('*')
            .in('bill_id', billIds);
          transData = transactions || [];
        }

        // Fetch firm transactions for all mahajans
        const mahajanIds = data.map(m => m.id);
        const { data: firmTrans } = await supabase
          .from('firm_transactions')
          .select('*')
          .in('mahajan_id', mahajanIds);
        firmTransData = firmTrans || [];
      }

      // Set all states together to prevent flickering
      setAllTransactions(transData);
      setFirmTransactions(firmTransData);
      setMahajans(data || []);
    } catch (error) {
      console.error('Error fetching mahajans:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch mahajans',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateBillBalance = (billId: string) => {
    const billTransactions = allTransactions.filter(t => t.bill_id === billId);
    const totalPaid = billTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const bill = mahajans.flatMap(m => m.bills || []).find(b => b.id === billId);
    return bill ? Number(bill.bill_amount) - totalPaid : 0;
  };

  const calculateInterest = (bill: { interest_rate?: number; interest_type?: string; bill_date?: string }, balance: number) => {
    if (!bill.interest_rate || bill.interest_type === 'none') return 0;

    const rate = bill.interest_rate / 100;
    const startDate = new Date(bill.bill_date || new Date());
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

  const calculateOutstandingBalance = (mahajan: Mahajan) => {
    if (!mahajan.bills) return 0;

    const billsTotal = mahajan.bills.reduce((total, bill) => {
      const balance = calculateBillBalance(bill.id);
      const interest = calculateInterest(bill, balance);
      return total + balance + interest;
    }, 0);

    // Calculate total firm transactions (payments) for this mahajan
    const firmPayments = firmTransactions
      .filter(ft => ft.mahajan_id === mahajan.id)
      .reduce((sum, ft) => sum + Number(ft.amount), 0);

    // Subtract both advance payment and firm payments from outstanding
    const advancePayment = mahajan.advance_payment || 0;
    return billsTotal - advancePayment - firmPayments;
  };

  const handleDeleteMahajan = async (mahajanId: string) => {
    if (!confirm('Are you sure you want to delete this mahajan? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mahajans')
        .delete()
        .eq('id', mahajanId);

      if (error) throw error;

      toast({
        title: 'Mahajan deleted',
        description: 'The mahajan has been successfully deleted.',
      });

      fetchMahajans();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting mahajan:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete mahajan',
      });
    }
  };

  const handleEditMahajan = (mahajan: Mahajan) => {
    setMahajanToEdit(mahajan);
    setEditDialogOpen(true);
  };

  const handleAddBill = (mahajan: Mahajan) => {
    setMahajanForBill(mahajan);
    setAddBillDialogOpen(true);
  };

  const filteredMahajans = mahajans.filter(mahajan =>
    mahajan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mahajan.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mahajan.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMahajans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMahajans = filteredMahajans.slice(startIndex, endIndex);

  // Totals for the current page in table view
  const pageActiveBillsTotal = paginatedMahajans.reduce((sum, m) => 
    sum + (m.bills?.filter(bill => bill.is_active).length || 0), 0);
  const pageOutstandingTotal = paginatedMahajans.reduce((sum, m) =>
    sum + calculateOutstandingBalance(m), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading mahajans...</div>
        </CardContent>
      </Card>
    );
  }

  if (selectedMahajan) {
    return (
      <MahajanDetails
        mahajan={selectedMahajan}
        onBack={() => setSelectedMahajan(null)}
        onUpdate={fetchMahajans}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Mahajan Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search mahajans by name, phone, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Table view button */}
          <Button
            variant="outline"
            size="sm"
            className="mb-2"
            onClick={() => setShowTableView(prev => !prev)}
          >
            {showTableView ? 'Back to Card View' : 'View Mahajan List in Table'}
          </Button>
        </CardContent>
      </Card>

      {/* Table or Cards */}
      {showTableView ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Phone</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Address</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Active Bills</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Outstanding</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedMahajans.map((mahajan) => {
                const outstandingBalance = calculateOutstandingBalance(mahajan);
                const activeBills = mahajan.bills?.filter(bill => bill.is_active).length || 0;
                return (
                  <tr key={mahajan.id}>
                    <td className="px-3 py-2">{mahajan.name}</td>
                    <td className="px-3 py-2">{mahajan.phone || '-'}</td>
                    <td className="px-3 py-2">{mahajan.address || '-'}</td>
                    <td className="px-3 py-2">{activeBills}</td>
                    <td className={`px-3 py-2 ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(outstandingBalance)}
                    </td>
                    <td className="px-3 py-2 space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedMahajan(mahajan)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMahajanForPayment(mahajan);
                          setPaymentDialogOpen(true);
                        }}
                        className="text-green-600 hover:text-green-700"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      {controlSettings.allowEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMahajan(mahajan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {controlSettings.allowDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMahajan(mahajan.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {controlSettings.allowBillManagement && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBill(mahajan)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* TOTAL ROW */}
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-right">Total (this page):</td>
                <td className="px-3 py-2">{pageActiveBillsTotal}</td>
                <td className="px-3 py-2">{formatCurrency(pageOutstandingTotal)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedMahajans.map((mahajan) => {
            const outstandingBalance = calculateOutstandingBalance(mahajan);
            const activeBills = mahajan.bills?.filter(bill => bill.is_active).length || 0;
            
            return (
              <Card key={mahajan.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{mahajan.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {mahajan.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{mahajan.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {controlSettings.allowEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMahajan(mahajan)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        )}
                        {controlSettings.allowDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMahajan(mahajan.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {mahajan.address && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{mahajan.address}</span>
                      </div>
                    )}
                    
                    {mahajan.payment_day && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="capitalize">{mahajan.payment_day}</span>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <div className="text-muted-foreground">Active Bills</div>
                          <div className="font-medium">{activeBills}</div>
                        </div>
                        <div className="text-sm text-right">
                          <div className="text-muted-foreground">Outstanding</div>
                          <div className={`font-medium ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(outstandingBalance)}
                          </div>
                        </div>
                      </div>

                      {mahajan.advance_payment && mahajan.advance_payment > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t border-dashed">
                          <div className="text-sm">
                            <div className="text-muted-foreground">Advance Payment</div>
                            <div className="font-medium text-green-600">
                              {formatCurrency(mahajan.advance_payment)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMahajanForAdvance(mahajan);
                              setAdvanceDetailsOpen(true);
                            }}
                            className="h-8 px-2"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMahajan(mahajan)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMahajanForPayment(mahajan);
                          setPaymentDialogOpen(true);
                        }}
                        className="flex-1 text-green-600 hover:text-green-700"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pay
                      </Button>
                      {controlSettings.allowBillManagement && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBill(mahajan)}
                          className="flex-1"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Bill
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredMahajans.length)} of {filteredMahajans.length} mahajans
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {filteredMahajans.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              {searchQuery ? 'No mahajans found matching your search.' : 'No mahajans found. Add your first mahajan to get started.'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {editDialogOpen && mahajanToEdit && (
        <EditMahajanDialog
          mahajan={mahajanToEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onMahajanUpdated={() => {
            fetchMahajans();
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {/* Add Bill Dialog */}
      {addBillDialogOpen && mahajanForBill && (
        <AddBillDialog
          mahajan={mahajanForBill}
          open={addBillDialogOpen}
          onOpenChange={setAddBillDialogOpen}
          onBillAdded={() => {
            fetchMahajans();
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {/* Advance Payment Details Dialog */}
      {advanceDetailsOpen && selectedMahajanForAdvance && (
        <AdvancePaymentDetailsDialog
          open={advanceDetailsOpen}
          onOpenChange={setAdvanceDetailsOpen}
          mahajanId={selectedMahajanForAdvance.id}
          mahajanName={selectedMahajanForAdvance.name}
        />
      )}

      {/* Record Payment Dialog */}
      {paymentDialogOpen && selectedMahajanForPayment && (
        <RecordMahajanPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          mahajanId={selectedMahajanForPayment.id}
          mahajanName={selectedMahajanForPayment.name}
          outstandingBalance={calculateOutstandingBalance(selectedMahajanForPayment)}
          onPaymentRecorded={() => {
            fetchMahajans();
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
};

export default MahajanList;
