import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, endOfWeek, addWeeks, format, isWithinInterval } from 'date-fns';

interface Cheque {
  id: string;
  type: 'received' | 'issued';
  cheque_number: string;
  cheque_date: string;
  amount: number;
  bank_name: string;
  status: 'pending' | 'processing' | 'cleared' | 'bounced';
  party_name: string | null;
  mahajan_name?: string | null;
}

export default function ChequeWeeklyView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(addWeeks(new Date(), currentWeekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(new Date(), currentWeekOffset), { weekStartsOn: 1 });

  useEffect(() => {
    if (user) {
      fetchCheques();
    }
  }, [user, currentWeekOffset]);

  const fetchCheques = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cheques')
        .select(`
          *,
          mahajans (
            name
          )
        `)
        .eq('user_id', user?.id)
        .order('cheque_date', { ascending: true });

      if (error) throw error;

      const chequesData = data?.map(cheque => ({
        ...cheque,
        mahajan_name: cheque.mahajans?.name || null,
      })) || [];

      // Filter cheques for current week
      const weekCheques = chequesData.filter((cheque) => {
        const chequeDate = new Date(cheque.cheque_date);
        return isWithinInterval(chequeDate, { start: weekStart, end: weekEnd });
      });

      setCheques(weekCheques);
    } catch (error: any) {
      toast.error('Error fetching cheques: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      processing: 'secondary',
      cleared: 'default',
      bounced: 'destructive',
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  const groupByStatus = (type: 'received' | 'issued') => {
    const filtered = cheques.filter(c => c.type === type);
    return {
      pending: filtered.filter(c => c.status === 'pending'),
      processing: filtered.filter(c => c.status === 'processing'),
      cleared: filtered.filter(c => c.status === 'cleared'),
      bounced: filtered.filter(c => c.status === 'bounced'),
    };
  };

  const receivedGroups = groupByStatus('received');
  const issuedGroups = groupByStatus('issued');

  const renderChequeCard = (cheque: Cheque) => (
    <Card key={cheque.id} className="mb-2">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{cheque.cheque_number}</p>
            <p className="text-sm text-muted-foreground">{cheque.bank_name}</p>
            <p className="text-sm text-muted-foreground">
              {cheque.type === 'received' ? cheque.party_name : cheque.mahajan_name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">₹{cheque.amount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(cheque.cheque_date), 'dd MMM')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar 
          onSettingsClick={() => navigate('/settings')} 
          onProfileClick={() => navigate('/profile')} 
        />
        <SidebarInset>
          <div className="flex justify-center p-8">Loading...</div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar 
        onSettingsClick={() => navigate('/settings')} 
        onProfileClick={() => navigate('/profile')} 
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Button variant="ghost" size="icon" onClick={() => navigate('/cheques')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Weekly Cheque Status</h1>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {/* Week Navigation */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous Week
                </Button>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {format(weekStart, 'dd MMM')} - {format(weekEnd, 'dd MMM yyyy')}
                  </span>
                </div>

                <div className="flex gap-2">
                  {currentWeekOffset !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentWeekOffset(0)}
                    >
                      This Week
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
                  >
                    Next Week
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Received Cheques */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Received Cheques</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Pending</span>
                    <Badge variant="outline">{receivedGroups.pending.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receivedGroups.pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending cheques</p>
                  ) : (
                    receivedGroups.pending.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Processing</span>
                    <Badge variant="secondary">{receivedGroups.processing.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receivedGroups.processing.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No processing cheques</p>
                  ) : (
                    receivedGroups.processing.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Cleared</span>
                    <Badge variant="default">{receivedGroups.cleared.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receivedGroups.cleared.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cleared cheques</p>
                  ) : (
                    receivedGroups.cleared.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Bounced</span>
                    <Badge variant="destructive">{receivedGroups.bounced.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receivedGroups.bounced.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bounced cheques</p>
                  ) : (
                    receivedGroups.bounced.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Issued Cheques */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Issued Cheques</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Pending</span>
                    <Badge variant="outline">{issuedGroups.pending.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issuedGroups.pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending cheques</p>
                  ) : (
                    issuedGroups.pending.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Processing</span>
                    <Badge variant="secondary">{issuedGroups.processing.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issuedGroups.processing.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No processing cheques</p>
                  ) : (
                    issuedGroups.processing.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Cleared</span>
                    <Badge variant="default">{issuedGroups.cleared.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issuedGroups.cleared.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cleared cheques</p>
                  ) : (
                    issuedGroups.cleared.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Bounced</span>
                    <Badge variant="destructive">{issuedGroups.bounced.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {issuedGroups.bounced.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bounced cheques</p>
                  ) : (
                    issuedGroups.bounced.map(renderChequeCard)
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
