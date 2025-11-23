import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, TrendingUp, Clock, CheckCircle, XCircle, Bell, FileText, History, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AddChequeDialog } from '@/components/AddChequeDialog';
import { EditChequeDialog } from '@/components/EditChequeDialog';
import { ChequeStatusHistory } from '@/components/ChequeStatusHistory';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Cheque {
  id: string;
  type: 'received' | 'issued';
  cheque_number: string;
  cheque_date: string;
  amount: number;
  bank_name: string;
  status: 'pending' | 'processing' | 'cleared' | 'bounced';
  bank_transaction_id: string | null;
  bounce_charges: number;
  mahajan_id: string | null;
  firm_account_id: string | null;
  party_name: string | null;
  notes: string | null;
  cleared_date: string | null;
  firm_account_name?: string | null;
  mahajan_name?: string | null;
}

export default function Cheques() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [receivedCheques, setReceivedCheques] = useState<Cheque[]>([]);
  const [issuedCheques, setIssuedCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [chequeType, setChequeType] = useState<'received' | 'issued'>('received');

  useEffect(() => {
    if (user) {
      fetchCheques();
    }
  }, [user]);

  const fetchCheques = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cheques')
        .select(`
          *,
          firm_accounts (
            account_name
          ),
          mahajans (
            name
          )
        `)
        .eq('user_id', user?.id)
        .order('cheque_date', { ascending: false });

      if (error) throw error;

      const chequesData = data?.map(cheque => ({
        ...cheque,
        firm_account_name: cheque.firm_accounts?.account_name || null,
        mahajan_name: cheque.mahajans?.name || null,
      })) || [];

      const received = chequesData.filter((c) => c.type === 'received');
      const issued = chequesData.filter((c) => c.type === 'issued');
      
      setReceivedCheques(received);
      setIssuedCheques(issued);
    } catch (error: any) {
      toast.error('Error fetching cheques: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCheque) return;

    try {
      const { error } = await supabase
        .from('cheques')
        .delete()
        .eq('id', selectedCheque.id);

      if (error) throw error;

      toast.success('Cheque deleted successfully');
      fetchCheques();
      setDeleteDialogOpen(false);
      setSelectedCheque(null);
    } catch (error: any) {
      toast.error('Error deleting cheque: ' + error.message);
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

  const renderChequeTable = (cheques: Cheque[], type: 'received' | 'issued') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cheque No.</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Bank</TableHead>
          {type === 'received' ? <TableHead>Party</TableHead> : <TableHead>Mahajan</TableHead>}
          <TableHead>Firm Account</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cheques.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No cheques found
            </TableCell>
          </TableRow>
        ) : (
          cheques.map((cheque) => (
            <TableRow key={cheque.id}>
              <TableCell className="font-medium">{cheque.cheque_number}</TableCell>
              <TableCell>{new Date(cheque.cheque_date).toLocaleDateString()}</TableCell>
              <TableCell>₹{cheque.amount.toLocaleString()}</TableCell>
              <TableCell>{cheque.bank_name}</TableCell>
              <TableCell>
                {type === 'received' 
                  ? (cheque.party_name || '-') 
                  : (cheque.mahajan_name || '-')}
              </TableCell>
              <TableCell>
                {cheque.firm_account_name ? (
                  <span className="text-sm">{cheque.firm_account_name}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(cheque.status)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedCheque(cheque);
                      setHistoryDialogOpen(true);
                    }}
                    title="View Status History"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedCheque(cheque);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {cheque.status !== 'cleared' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedCheque(cheque);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  // Calculate summary statistics
  const allCheques = [...receivedCheques, ...issuedCheques];
  const summary = {
    pending: {
      count: allCheques.filter(c => c.status === 'pending').length,
      amount: allCheques.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0)
    },
    processing: {
      count: allCheques.filter(c => c.status === 'processing').length,
      amount: allCheques.filter(c => c.status === 'processing').reduce((sum, c) => sum + c.amount, 0)
    },
    cleared: {
      count: allCheques.filter(c => c.status === 'cleared').length,
      amount: allCheques.filter(c => c.status === 'cleared').reduce((sum, c) => sum + c.amount, 0)
    },
    bounced: {
      count: allCheques.filter(c => c.status === 'bounced').length,
      amount: allCheques.filter(c => c.status === 'bounced').reduce((sum, c) => sum + c.amount, 0)
    }
  };

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
          <h1 className="text-xl font-semibold">Cheque Management</h1>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/cheque-reminders')}>
              <Bell className="h-4 w-4 mr-2" />
              Reminders
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/cheque-reconciliation')}>
              <FileText className="h-4 w-4 mr-2" />
              Reconciliation
            </Button>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Cheque
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {/* Weekly View Card */}
          <Card 
            className="cursor-pointer hover:bg-accent transition-colors border-primary/20"
            onClick={() => navigate('/cheques/weekly')}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Weekly Cheque Status</CardTitle>
                  <CardDescription>View cheques organized by week with detailed status tracking</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.pending.count}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{summary.pending.amount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Processing</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.processing.count}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{summary.processing.amount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cleared</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.cleared.count}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{summary.cleared.amount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bounced</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.bounced.count}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{summary.bounced.amount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cheque Tabs */}
          <Tabs defaultValue="received" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="received">Received Cheques</TabsTrigger>
          <TabsTrigger value="issued">Issued Cheques</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setChequeType('received');
                setAddDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Received Cheque
            </Button>
          </div>
          {renderChequeTable(receivedCheques, 'received')}
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setChequeType('issued');
                setAddDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Issued Cheque
            </Button>
          </div>
          {renderChequeTable(issuedCheques, 'issued')}
        </TabsContent>
          </Tabs>
        </div>

        <AddChequeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        type={chequeType}
        onSuccess={fetchCheques}
      />

      {selectedCheque && (
        <EditChequeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          cheque={selectedCheque}
          onSuccess={fetchCheques}
        />
      )}

      {selectedCheque && (
        <ChequeStatusHistory
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          chequeId={selectedCheque.id}
          chequeNumber={selectedCheque.cheque_number}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cheque</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cheque? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
