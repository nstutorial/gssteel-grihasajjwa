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
import AddBillDialog from './AddBillDialog';
import { Plus, Search, Edit, Phone, Mail, MapPin } from 'lucide-react';
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
}

export function BillCustomersList() {
  const { user } = useAuth();
  const { settings: controlSettings } = useControl();
  const [customers, setCustomers] = useState<BillCustomer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<BillCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addBillDialogOpen, setAddBillDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<BillCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('bill_customers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bill customers:', error);
      toast.error('Failed to load bill customers');
      setLoading(false);
      return;
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

  const handleAddBill = (customer: BillCustomer) => {
    setSelectedCustomer(customer);
    setAddBillDialogOpen(true);
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
                  {controlSettings.allowEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
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
                      ₹{customer.outstanding_amount.toFixed(2)}
                    </TableCell>
                    {controlSettings.allowEdit && (
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddBill(customer)}
                            title="Add Bill"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                            title="Edit Customer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
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

      <AddBillDialog
        open={addBillDialogOpen}
        onOpenChange={setAddBillDialogOpen}
        mahajan={selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null}
        onBillAdded={fetchCustomers}
      />
    </Card>
  );
}
