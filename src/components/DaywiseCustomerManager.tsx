import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronRight, Users, MapPin, Calendar, Phone } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
  loans: Array<{
    id: string;
    principal_amount: number;
    is_active: boolean;
    outstanding_balance?: number;
  }>;
}

interface AddressGroup {
  address: string;
  customers: Customer[];
}

interface DayGroup {
  paymentDay: string;
  addressGroups: AddressGroup[];
}

const DaywiseCustomerManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [paymentModes, setPaymentModes] = useState<Record<string, 'cash' | 'bank'>>({});
  const [paymentLoading, setPaymentLoading] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch customers with their loans
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          phone,
          address,
          payment_day,
          loans (
            id,
            principal_amount,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .order('payment_day', { ascending: true });

      if (customersError) throw customersError;

      // Fetch loan transactions to calculate outstanding balances
      const customerIds = customersData?.map(c => c.id) || [];
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select(`
          id,
          customer_id,
          principal_amount,
          is_active,
          loan_transactions (
            amount
          )
        `)
        .in('customer_id', customerIds)
        .eq('user_id', user.id);

      if (loansError) throw loansError;

      // Calculate outstanding balances
      const customersWithBalances = customersData?.map(customer => {
        const customerLoans = loansData?.filter(loan => loan.customer_id === customer.id) || [];
        const loansWithBalance = customerLoans.map(loan => {
          const paidAmount = loan.loan_transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
          const outstandingBalance = Math.max(0, loan.principal_amount - paidAmount);
          return {
            ...loan,
            outstanding_balance: outstandingBalance,
          };
        });

        return {
          ...customer,
          loans: loansWithBalance,
        };
      }) || [];

      console.log('Fetched customers with balances:', customersWithBalances);

      setCustomers(customersWithBalances);
      organizeCustomersData(customersWithBalances);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch customers',
      });
    } finally {
      setLoading(false);
    }
  };

  const organizeCustomersData = (allCustomers: Customer[]) => {
    // Group by day first, then by address
    const dayMap = new Map<string, Map<string, Customer[]>>();
    
    allCustomers.forEach(customer => {
      const day = customer.payment_day || 'Not Set';
      const address = customer.address || 'No Address';
      
      if (!dayMap.has(day)) {
        dayMap.set(day, new Map());
      }
      
      if (!dayMap.get(day)!.has(address)) {
        dayMap.get(day)!.set(address, []);
      }
      
      dayMap.get(day)!.get(address)!.push(customer);
    });

    // Convert to structured format
    const groupedData: DayGroup[] = Array.from(dayMap.entries()).map(([paymentDay, addressMap]) => ({
      paymentDay,
      addressGroups: Array.from(addressMap.entries()).map(([address, customers]) => ({
        address,
        customers,
      })),
    }));

    setDayGroups(groupedData);
  };

  const toggleDayExpansion = (day: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        newSet.delete(day);
        // Also collapse all addresses under this day when collapsing the day
        setExpandedAddresses(prevAddresses => {
          const newAddressSet = new Set(prevAddresses);
          dayGroups
            .find(dg => dg.paymentDay === day)
            ?.addressGroups.forEach(ag => {
              newAddressSet.delete(`${day}-${ag.address}`);
            });
          return newAddressSet;
        });
      } else {
        newSet.add(day);
      }
      return newSet;
    });
  };

  const toggleAddressExpansion = (day: string, address: string) => {
    const addressKey = `${day}-${address}`;
    setExpandedAddresses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(addressKey)) {
        newSet.delete(addressKey);
      } else {
        newSet.add(addressKey);
      }
      return newSet;
    });
  };

  const handlePaymentInputChange = (customerId: string, value: string) => {
    setPaymentInputs(prev => ({
      ...prev,
      [customerId]: value,
    }));
  };

  const handlePaymentModeChange = (customerId: string, mode: 'cash' | 'bank') => {
    setPaymentModes(prev => ({
      ...prev,
      [customerId]: mode,
    }));
  };

  const handlePaymentSubmit = async (customer: Customer) => {
    const amountStr = paymentInputs[customer.id];
    if (!amountStr || parseFloat(amountStr) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid payment amount',
      });
      return;
    }

    // Prevent double submission
    if (paymentLoading[customer.id]) {
      return;
    }

    const amount = parseFloat(amountStr);
    console.log('Payment submission started:', { customer: customer.name, amount, loans: customer.loans });

    // Set loading state
    setPaymentLoading(prev => ({
      ...prev,
      [customer.id]: true,
    }));

    try {
      // Create transactions for each active loan of this customer
      const transactions = [];
      
      // Check if customer has loans
      if (!customer.loans || customer.loans.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Loans Found',
          description: `No loans found for customer ${customer.name}`,
        });
        return;
      }

      // Calculate total outstanding balance across all active loans
      const totalOutstanding = customer.loans
        .filter(loan => loan.is_active && loan.outstanding_balance && loan.outstanding_balance > 0)
        .reduce((sum, loan) => sum + (loan.outstanding_balance || 0), 0);

      console.log('Total outstanding:', totalOutstanding, 'Payment amount:', amount);

      if (totalOutstanding === 0) {
        toast({
          variant: 'destructive',
          title: 'No Outstanding Balance',
          description: `No outstanding balance found for ${customer.name}`,
        });
        return;
      }

      let remainingAmount = amount;

      for (const loan of customer.loans) {
        console.log('Checking loan:', { loanId: loan.id, isActive: loan.is_active, outstandingBalance: loan.outstanding_balance });
        
        if (loan.is_active && loan.outstanding_balance && loan.outstanding_balance > 0 && remainingAmount > 0) {
          const paymentForThisLoan = Math.min(remainingAmount, loan.outstanding_balance);
          
          transactions.push({
            loan_id: loan.id,
            amount: paymentForThisLoan,
            transaction_type: 'principal',
            payment_mode: paymentModes[customer.id] || 'cash',
            notes: `Payment received from ${customer.name}`,
          });

          remainingAmount -= paymentForThisLoan;
          console.log(`Payment ${paymentForThisLoan} for loan ${loan.id}, remaining: ${remainingAmount}`);
        }
      }

      console.log('Created transactions:', transactions);

      if (transactions.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Active Loans',
          description: `No active loans with outstanding balance found for ${customer.name}`,
        });
        return;
      }

      const { data, error } = await supabase
        .from('loan_transactions')
        .insert(transactions)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Payment recorded successfully:', data);

      // Clear the payment input
      setPaymentInputs(prev => ({
        ...prev,
        [customer.id]: '',
      }));

      toast({
        title: 'Payment Recorded',
        description: `Payment of ${amount} recorded successfully for ${customer.name}`,
      });

      fetchCustomers();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to record payment: ${error.message || 'Unknown error'}`,
      });
    } finally {
      // Clear loading state
      setPaymentLoading(prev => ({
        ...prev,
        [customer.id]: false,
      }));
    }
  };

  const calculateDayTotal = (dayGroup: DayGroup) => {
    return dayGroup.addressGroups.reduce((daySum, addressGroup) => {
      return daySum + addressGroup.customers.reduce((addressSum, customer) => {
        return addressSum + customer.loans.reduce((loanSum, loan) => loanSum + (loan.outstanding_balance || 0), 0);
      }, 0);
    }, 0);
  };

  const calculateAddressTotal = (day: string, address: string) => {
    const dayGroup = dayGroups.find(dg => dg.paymentDay === day);
    if (!dayGroup) return 0;
    
    const addressGroup = dayGroup.addressGroups.find(ag => ag.address === address);
    if (!addressGroup) return 0;
    
    return addressGroup.customers.reduce((total, customer) => {
      return total + customer.loans.reduce((loanSum, loan) => loanSum + (loan.outstanding_balance || 0), 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading customers...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Daywise Customer Payment Manager</h3>
      </div>

      {dayGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No customers found. Add customers to see them organized by payment day.</p>
          </CardContent>
        </Card>
      ) : (
        dayGroups.map((dayGroup) => {
          const totalDayOutstanding = calculateDayTotal(dayGroup);
          const totalCustomersInDay = dayGroup.addressGroups.reduce((sum, ag) => sum + ag.customers.length, 0);
          const isDayExpanded = expandedDays.has(dayGroup.paymentDay);

          return (
            <Card key={dayGroup.paymentDay}>
              {/* Day Header */}
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-blue-500"
                onClick={() => toggleDayExpansion(dayGroup.paymentDay)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isDayExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex items-center gap-2 text-sm sm:text-base">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      <span className="font-medium">Payment Day: {dayGroup.paymentDay}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      {totalCustomersInDay} customers
                    </Badge>
                    <Badge variant={totalDayOutstanding > 0 ? "default" : "secondary"} className="min-w-0 max-w-full px-2 py-1 text-xs">
                      <span className="truncate">{totalDayOutstanding.toFixed(2)}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {/* Day Content - Address Groups */}
              {isDayExpanded && (
                <CardContent className="pt-0 pl-0 pr-0">
                  <div className="space-y-2 ml-4 border-l-2 border-l-slate-200 pl-4">
                    {dayGroup.addressGroups.map((addressGroup) => {
                      const addressKey = `${dayGroup.paymentDay}-${addressGroup.address}`;
                      const totalAddressOutstanding = calculateAddressTotal(dayGroup.paymentDay, addressGroup.address);
                      const isAddressExpanded = expandedAddresses.has(addressKey);

                      return (
                        <Card key={addressKey} className="border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-950/20">
                          {/* Address Header */}
                          <CardHeader 
                            className="cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/20 transition-colors pb-2 py-3"
                            onClick={() => toggleAddressExpansion(dayGroup.paymentDay, addressGroup.address)}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {isAddressExpanded ? (
                                <ChevronDown className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground flex-shrink-0" />
                              )}
                              <div className="flex items-center gap-2 text-sm sm:text-base">
                                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                                <span className="font-medium">{addressGroup.address}</span>
                              </div>
                              <div className="flex items-center gap-2 ml-auto flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {addressGroup.customers.length} customer{addressGroup.customers.length !== 1 ? 's' : ''}
                                </Badge>
                                <Badge variant={totalAddressOutstanding > 0 ? "default" : "secondary"} className="text-xs min-w-0">
                                  <span className="truncate">{totalAddressOutstanding.toFixed(2)}</span>
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>

                          {/* Address Content - Customers with Payment Inputs */}
                          {isAddressExpanded && (
                            <CardContent className="pt-4">
                              <div className="space-y-4">
                                {addressGroup.customers.map((customer) => {
                                  const customerOutstanding = customer.loans.reduce((sum, loan) => sum + (loan.outstanding_balance || 0), 0);
                                  
                                  return (
                                    <Card key={customer.id} className="border">
                                      <CardContent className="p-4">
                                        <div className="space-y-4">
                                          {/* Customer Info */}
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <div className="font-medium text-lg">{customer.name}</div>
                                              {customer.phone && (
                                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                  <Phone className="h-3 w-3" />
                                                  {customer.phone}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-right">
                                              <div className="text-lg font-medium text-orange-600">
                                                {customerOutstanding.toFixed(2)}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                Outstanding Balance
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {customer.loans.length} active loan{customer.loans.length !== 1 ? 's' : ''}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Payment Input */}
                                          <div className="border-t pt-4">
                                            <div className="space-y-4">
                                              <div>
                                                <Label htmlFor={`payment-${customer.id}`}>
                                                  Record Payment for {customer.name}
                                                </Label>
                                                <Input
                                                  id={`payment-${customer.id}`}
                                                  type="number"
                                                  placeholder="Enter payment amount"
                                                  value={paymentInputs[customer.id] || ''}
                                                  onChange={(e) => handlePaymentInputChange(customer.id, e.target.value)}
                                                  className="mt-1"
                                                />
                                              </div>
                                              
                                              <div>
                                                <Label htmlFor={`payment-mode-${customer.id}`}>
                                                  Payment Mode
                                                </Label>
                                                <Select 
                                                  value={paymentModes[customer.id] || 'cash'} 
                                                  onValueChange={(value: 'cash' | 'bank') => 
                                                    handlePaymentModeChange(customer.id, value)
                                                  }
                                                >
                                                  <SelectTrigger className="mt-1">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="bank">Bank Transfer</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <Button 
                                                onClick={() => {
                                                  console.log('Payment button clicked for:', customer.name);
                                                  handlePaymentSubmit(customer);
                                                }}
                                                disabled={paymentLoading[customer.id]}
                                                className="w-full"
                                              >
                                                {paymentLoading[customer.id] ? 'Recording...' : 'Record Payment'}
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
};

export default DaywiseCustomerManager;
