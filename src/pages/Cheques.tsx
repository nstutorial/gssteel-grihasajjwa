import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
  FileText,
  History,
  CalendarDays,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
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

  // Auto-detect mobile
  const isMobile = window.innerWidth < 768;

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  useEffect(() => {
    if (user) fetchCheques();
  }, [user]);

  const fetchCheques = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('cheques')
        .select(
          `
          *,
          firm_accounts (account_name),
          mahajans (name)
        `
        )
        .eq('user_id', user?.id)
        .order('cheque_date', { ascending: false });

      if (error) throw error;

      const formatted = data?.map((c: any) => ({
        ...c,
        firm_account_name: c.firm_accounts?.account_name || null,
        mahajan_name: c.mahajans?.name || null,
      }));

      setReceivedCheques(formatted.filter((c: Cheque) => c.type === 'received'));
      setIssuedCheques(formatted.filter((c: Cheque) => c.type === 'issued'));
    } catch (err: any) {
      toast.error('Error fetching cheques: ' + err.message);
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
    } catch (err: any) {
      toast.error('Error deleting cheque: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      pending: 'outline',
      processing: 'secondary',
      cleared: 'default',
      bounced: 'destructive',
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  // DESKTOP TABLE RENDER
  const renderChequeTable = (cheques: Cheque[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cheque No</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Party / Mahajan</TableHead>
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
              <TableCell>{cheque.cheque_number}</TableCell>
              <TableCell>
                {new Date(cheque.cheque_date).toLocaleDateString()}
              </TableCell>
              <TableCell>₹{cheque.amount.toLocaleString()}</TableCell>
              <TableCell>{cheque.bank_name}</TableCell>
              <TableCell>{cheque.party_name || cheque.mahajan_name || '-'}</TableCell>
              <TableCell>{cheque.firm_account_name || '-'}</TableCell>
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

  // ANDROID MOBILE CARD UI
  const renderMobileCards = (cheques: Cheque[]) => (
    <div className="flex flex-col gap-4">
      {cheques.length === 0 && (
        <p className="text-center text-muted-foreground">No cheques found</p>
      )}

      {cheques.map((cheque) => (
        <Card
          key={cheque.id}
          className="shadow-md rounded-xl p-4 border border-gray-200"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">
              Cheque No: {cheque.cheque_number}
            </h2>

            <p className="text-sm text-muted-foreground">
              Date: {new Date(cheque.cheque_date).toLocaleDateString()}
            </p>

            <p className="font-semibold text-primary text-lg">
              ₹{cheque.amount.toLocaleString()}
            </p>

            <p className="text-sm">
              <strong>Bank:</strong> {cheque.bank_name}
            </p>

            <p className="text-sm">
              <strong>Party / Mahajan:</strong>{' '}
              {cheque.party_name || cheque.mahajan_name || '-'}
            </p>

            <p className="text-sm">
              <strong>Firm Account:</strong> {cheque.firm_account_name || '-'}
            </p>

            <div>{getStatusBadge(cheque.status)}</div>

            {/* BUTTON ROW */}
            <div className="flex gap-3 mt-2">
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => {
                  setSelectedCheque(cheque);
                  setHistoryDialogOpen(true);
                }}
              >
                <History className="h-4 w-4 mr-2" /> History
              </Button>

              <Button
                className="flex-1"
                variant="default"
                onClick={() => {
                  setSelectedCheque(cheque);
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="h-4 w-4 mr-2" /> Edit
              </Button>

              {cheque.status !== 'cleared' && (
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={() => {
                    setSelectedCheque(cheque);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  // SUMMARY
  const all = [...receivedCheques, ...issuedCheques];
  const summary = {
    pending: {
      count: all.filter((c) => c.status === 'pending').length,
      amount: all
        .filter((c) => c.status === 'pending')
        .reduce((a, b) => a + b.amount, 0),
    },
    processing: {
      count: all.filter((c) => c.status === 'processing').length,
      amount: all
        .filter((c) => c.status === 'processing')
        .reduce((a, b) => a + b.amount, 0),
    },
    cleared: {
      count: all.filter((c) => c.status === 'cleared').length,
      amount: all
        .filter((c) => c.status === 'cleared')
        .reduce((a, b) => a + b.amount, 0),
    },
    bounced: {
      count: all.filter((c) => c.status === 'bounced').length,
      amount: all
        .filter((c) => c.status === 'bounced')
        .reduce((a, b) => a + b.amount, 0),
    },
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar onSettingsClick={handleSettingsClick} onProfileClick={handleProfileClick} />
        <SidebarInset>
          <div className="flex justify-center p-8">Loading...</div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar onSettingsClick={handleSettingsClick} onProfileClick={handleProfileClick} />
      <SidebarInset>
        {/* HEADER */}
        <header className="flex h-16 items-center gap-2 border-b px-3 md:px-4">
          <SidebarTrigger />

          <h1 className="text-lg md:text-xl font-semibold">Cheque Management</h1>

          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex"
              onClick={() => navigate('/cheque-reminders')}
            >
              <Bell className="h-4 w-4 mr-2" /> Reminders
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex"
              onClick={() => navigate('/cheque-reconciliation')}
            >
              <FileText className="h-4 w-4 mr-2" /> Reconciliation
            </Button>

            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <div className="p-3 md:p-6 flex flex-col gap-4">

          {/* WEEKLY CARD */}
          <Card
            className="cursor-pointer hover:bg-accent transition-colors border-primary/20 shadow-sm"
            onClick={() => navigate('/cheques/weekly')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base md:text-lg">
                    Weekly Cheque Status
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    View cheques organized by week
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* SUMMARY */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Pending', summary.pending, Clock],
              ['Processing', summary.processing, TrendingUp],
              ['Cleared', summary.cleared, CheckCircle],
              ['Bounced', summary.bounced, XCircle],
            ].map(([label, stat, Icon]: any) => (
              <Card key={label} className="shadow-sm">
                <CardHeader className="flex flex-row justify-between pb-2">
                  <CardTitle className="text-sm">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{stat.count}</div>
                  <p className="text-xs text-muted-foreground">
                    ₹{stat.amount.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* TABS */}
          <Tabs defaultValue="received" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="received">Received</TabsTrigger>
              <TabsTrigger value="issued">Issued</TabsTrigger>
            </TabsList>

            {/* RECEIVED */}
            <TabsContent value="received" className="space-y-4">
              <Button
                className="w-full md:w-auto"
                onClick={() => {
                  setChequeType('received');
                  setAddDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Received Cheque
              </Button>

              {isMobile
                ? renderMobileCards(receivedCheques)
                : renderChequeTable(receivedCheques)}
            </TabsContent>

            {/* ISSUED */}
            <TabsContent value="issued" className="space-y-4">
              <Button
                className="w-full md:w-auto"
                onClick={() => {
                  setChequeType('issued');
                  setAddDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Issued Cheque
              </Button>

              {isMobile
                ? renderMobileCards(issuedCheques)
                : renderChequeTable(issuedCheques)}
            </TabsContent>
          </Tabs>
        </div>

        {/* DIALOGS */}
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
                Are you sure? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
