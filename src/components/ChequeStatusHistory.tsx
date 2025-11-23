import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes: string | null;
}

interface ChequeStatusHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chequeId: string;
  chequeNumber: string;
}

const statusColors = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  cleared: 'bg-green-500/10 text-green-700 dark:text-green-400',
  bounced: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  cleared: 'Cleared',
  bounced: 'Bounced',
};

export function ChequeStatusHistory({ open, onOpenChange, chequeId, chequeNumber }: ChequeStatusHistoryProps) {
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, chequeId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cheque_status_history')
        .select('*')
        .eq('cheque_id', chequeId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      console.error('Error fetching status history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Status History - Cheque {chequeNumber}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No status changes recorded
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="relative pl-8 pb-4 border-l-2 border-border last:border-l-0"
                >
                  <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-primary" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.old_status && (
                        <>
                          <Badge variant="outline" className={statusColors[entry.old_status as keyof typeof statusColors]}>
                            {statusLabels[entry.old_status as keyof typeof statusLabels]}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      <Badge variant="outline" className={statusColors[entry.new_status as keyof typeof statusColors]}>
                        {statusLabels[entry.new_status as keyof typeof statusLabels]}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{format(new Date(entry.changed_at), 'PPp')}</span>
                    </div>

                    {entry.notes && (
                      <div className="text-sm bg-muted p-3 rounded-md">
                        <p className="font-medium mb-1">Notes:</p>
                        <p className="text-muted-foreground">{entry.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
