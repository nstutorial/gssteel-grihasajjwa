import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ArrowLeft, AlertCircle, Clock } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ChequeReminder {
  id: string;
  cheque_number: string;
  cheque_date: string;
  amount: number;
  bank_name: string;
  status: string;
  type: string;
  party_name: string | null;
  mahajan_name: string | null;
  days_pending: number;
}

const ChequeReminders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ChequeReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysThreshold, setDaysThreshold] = useState<number>(7);

  useEffect(() => {
    if (user) {
      fetchReminders();
    }
  }, [user, daysThreshold]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      
      // Fetch all cheques that are pending or processing
      const { data: cheques, error: chequesError } = await supabase
        .from('cheques')
        .select(`
          id,
          cheque_number,
          cheque_date,
          amount,
          bank_name,
          status,
          type,
          party_name,
          mahajan_id,
          mahajans (
            name
          )
        `)
        .eq('user_id', user?.id)
        .in('status', ['pending', 'processing'])
        .order('cheque_date', { ascending: true });

      if (chequesError) throw chequesError;

      // Calculate days pending and filter
      const remindersData: ChequeReminder[] = (cheques || [])
        .map(cheque => {
          const daysPending = differenceInDays(new Date(), new Date(cheque.cheque_date));
          return {
            id: cheque.id,
            cheque_number: cheque.cheque_number,
            cheque_date: cheque.cheque_date,
            amount: parseFloat(cheque.amount.toString()),
            bank_name: cheque.bank_name,
            status: cheque.status,
            type: cheque.type,
            party_name: cheque.party_name,
            mahajan_name: cheque.mahajans?.name || null,
            days_pending: daysPending,
          };
        })
        .filter(reminder => reminder.days_pending >= daysThreshold);

      setReminders(remindersData);
    } catch (error) {
      console.error('Error fetching cheque reminders:', error);
      toast.error('Failed to load cheque reminders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pending' },
      processing: { variant: 'default' as const, label: 'Processing' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge variant={type === 'received' ? 'default' : 'outline'}>
        {type === 'received' ? 'Received' : 'Issued'}
      </Badge>
    );
  };

  const getDaysColorClass = (days: number) => {
    if (days >= 30) return 'text-destructive font-semibold';
    if (days >= 14) return 'text-orange-600 font-semibold';
    return 'text-yellow-600';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar 
          onSettingsClick={() => navigate('/settings')}
          onProfileClick={() => navigate('/profile')}
        />
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/cheques')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Cheque Reminders</h1>
                  <p className="text-muted-foreground">Pending & Processing cheques requiring attention</p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Filter Settings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <Label>Days Threshold</Label>
                    <Input
                      type="number"
                      min="1"
                      value={daysThreshold}
                      onChange={(e) => setDaysThreshold(parseInt(e.target.value) || 7)}
                      className="w-32"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground mt-8">
                    Showing cheques pending for {daysThreshold}+ days
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Reminders</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reminders.length}</div>
                  <p className="text-xs text-muted-foreground">Cheques requiring attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{reminders.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">Combined value</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Days Pending</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reminders.length > 0
                      ? Math.round(reminders.reduce((sum, r) => sum + r.days_pending, 0) / reminders.length)
                      : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Average days</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cheques Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                {reminders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cheques pending for {daysThreshold}+ days
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cheque No</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Days Pending</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead>Party/Mahajan</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reminders.map((reminder) => (
                          <TableRow key={reminder.id}>
                            <TableCell className="font-medium">{reminder.cheque_number}</TableCell>
                            <TableCell>{getTypeBadge(reminder.type)}</TableCell>
                            <TableCell>{format(new Date(reminder.cheque_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              <span className={getDaysColorClass(reminder.days_pending)}>
                                {reminder.days_pending} days
                              </span>
                            </TableCell>
                            <TableCell>₹{reminder.amount.toLocaleString()}</TableCell>
                            <TableCell>{reminder.bank_name}</TableCell>
                            <TableCell>{reminder.party_name || reminder.mahajan_name || '-'}</TableCell>
                            <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ChequeReminders;
