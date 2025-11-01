import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BillCustomerStatement } from '@/components/BillCustomerStatement';
import { ArrowLeft, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface BillCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
}

export default function BillCustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<BillCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchCustomer();
    }
  }, [user, id]);

  const fetchCustomer = async () => {
    if (!user || !id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('bill_customers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to load customer details');
      navigate('/bill-customers');
      return;
    }

    setCustomer(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/bill-customers')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Customers
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">{customer.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{customer.address}</span>
              </div>
            )}
            {customer.gst_number && (
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span>GST: {customer.gst_number}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <BillCustomerStatement customer={customer} />
    </div>
  );
}
