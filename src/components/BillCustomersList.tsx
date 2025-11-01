import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useControl } from '@/contexts/ControlContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { AddBillCustomerDialog } from './AddBillCustomerDialog';
import { EditBillCustomerDialog } from './EditBillCustomerDialog';
import { AddSaleDialog } from './AddSaleDialog';
import { RecordSalePaymentDialog } from './RecordSalePaymentDialog';
import { Plus, Search, Edit, Phone, Mail, MapPin, DollarSign, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface BillCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  outstanding_amount: number;
  created_at: string;
  sales?: Array<{
    id: string;
    sale_amount: number;
    is_active: boolean;
  }>;
}

interface SaleTransaction {
  id: string;
  sale_id: string;
  amount: number;
  transaction_type: string;
}

export function BillCustomersList() {
  const { user } = useAuth();
  const { settings: controlSettings } = useControl();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<BillCustomer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<BillCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addSaleDialogOpen, setAddSaleDialogOpen] = useState(false);
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<BillCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<SaleTransaction[]>([]);

  const fetchCustomers = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('bill_customers')
      .select(`
        *,
        sales (id, sale_amount, is_active)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bill customers:', error);
      toast.error('Failed to load bill customers');
      setLoading(false);
      return;
    }

    // Fetch all transactions for calculating outstanding balances
    if (data && data.length > 0) {
      const saleIds = data.flatMap(c => c.sales?.map(s => s.id) || []);
      if (saleIds.length > 0) {
        const { data: transData } = await supabase
          .from('sale_transactions')
          .select('*')
          .in('sale_id', saleIds);
        setAllTransactions(transData || []);
      } else {
        setAllTransactions([]);
      }
    } else {
      setAllTransactions([]);
    }

    setCustomers(data || []);
    setFilteredCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.gst_number?.toLowerCase().includes(query)
    );
    setFilteredCustomers(filtered);
  }, [searchQuery, customers]);

  const handleEdit = (customer: BillCustomer) => {
    setSelectedCustomer(customer);
    setEditDialogOpen(true);
  };

  const handleAddSale = (customer: BillCustomer) => {
    setSelectedCustomer(customer);
    setAddSaleDialogOpen(true);
  };

  const handleRecordPayment = (customer: BillCustomer) => {
    const outstanding = calculateCustomerOutstanding(customer);
    setSelectedCustomer({
      ...customer,
      outstanding_amount: outstanding
    });
    setRecordPaymentDialogOpen(true);
  };

  const calculateCustomerOutstanding = (customer: BillCustomer) => {
    const activeSales = customer.sales?.filter(sale => sale.is_active) || [];
    return activeSales.reduce((sum, sale) => {
      const saleTransactions = allTransactions.filter(t => t.sale_id === sale.id);
      const totalPaid = saleTransactions
        .filter(t => t.transaction_type === 'payment')
        .reduce((transactionSum, t) => transactionSum + Number(t.amount), 0);
      const totalRefund = saleTransactions
        .filter(t => t.transaction_type === 'refund')
        .reduce((transactionSum, t) => transactionSum + Number(t.amount), 0);
      return sum + (Number(sale.sale_amount) - totalPaid + totalRefund);
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Bill Customers / Sale Customers</CardTitle>
          {controlSettings.allowAddNew && (
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, or GST..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No customers found matching your search' : 'No bill customers yet. Add your first customer!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GST Number</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const outstandingBalance = calculateCustomerOutstanding(customer);
                  
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                          )}
                          {customer.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.address}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{customer.gst_number || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹{outstandingBalance.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/bill-customers/${customer.id}`)}
                            title="View Statement"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRecordPayment(customer)}
                            title="Record Payment"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddSale(customer)}
                            title="Add Sale"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {controlSettings.allowEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(customer)}
                              title="Edit Customer"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AddBillCustomerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCustomerAdded={fetchCustomers}
      />

      <EditBillCustomerDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customer={selectedCustomer}
        onCustomerUpdated={fetchCustomers}
      />

      <AddSaleDialog
        open={addSaleDialogOpen}
        onOpenChange={setAddSaleDialogOpen}
        customer={selectedCustomer}
        onSaleAdded={fetchCustomers}
      />

      <RecordSalePaymentDialog
        open={recordPaymentDialogOpen}
        onOpenChange={setRecordPaymentDialogOpen}
        customer={selectedCustomer ? {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          outstanding: selectedCustomer.outstanding_amount
        } : null}
        onPaymentRecorded={fetchCustomers}
      />
    </Card>
  );
}
