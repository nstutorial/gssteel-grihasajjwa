import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useControl } from '@/contexts/ControlContext';

interface Transaction {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string | null;
  mahajan_name: string;
  source?: 'partner' | 'firm';
}

interface PartnerStatementProps {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
}

export function PartnerStatement({ transactions, onEdit, onDelete }: PartnerStatementProps) {
  const { settings } = useControl();
  const showActions = (settings.allowEdit || settings.allowDelete) && (onEdit || onDelete);

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Mahajan</TableHead>
            <TableHead>Payment Mode</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Notes</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground">
                No transactions found
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{format(new Date(transaction.payment_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{transaction.mahajan_name}</TableCell>
                <TableCell className="capitalize">{transaction.payment_mode}</TableCell>
                <TableCell className={`text-right font-medium ${
                  transaction.amount < 0 ? 'text-destructive' : 'text-green-600'
                }`}>
                  {transaction.amount < 0 ? '-' : '+'}₹{Math.abs(transaction.amount).toFixed(2)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {transaction.notes || '-'}
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {settings.allowEdit && onEdit && transaction.source === 'partner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(transaction)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {settings.allowDelete && onDelete && transaction.source === 'partner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
