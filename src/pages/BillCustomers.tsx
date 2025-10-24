import { BillCustomersList } from '@/components/BillCustomersList';

export default function BillCustomers() {
  return (
    <div className="container mx-auto p-6">
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
