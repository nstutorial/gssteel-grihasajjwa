import { BillCustomersList } from '@/components/BillCustomersList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BillCustomers() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Bill Customers</h1>
        <p className="text-muted-foreground mt-2">
          Manage your bill and sale customers
        </p>
      </div>
      <BillCustomersList />
    </div>
  );
}
