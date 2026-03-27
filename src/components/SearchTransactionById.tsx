import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractReferenceFromNotes, normalizeReferenceSearchTerm } from '@/lib/transaction-reference';

interface Transaction {
  id: string;
  bill_id: string;
  amount: number;
  transaction_type: 'principal' | 'interest' | 'mixed';
  payment_date: string;
  payment_mode: 'bank' | 'cash';
  notes?: string;
  bill?: {
    bill_number?: string;
    description?: string;
  };
}

interface SearchTransactionByIdProps {
  transactions: Transaction[];
  onUpdate?: () => void;
}

const SearchTransactionById = ({ transactions, onUpdate }: SearchTransactionByIdProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSearch = () => {
    const term = normalizeReferenceSearchTerm(searchTerm);

    if (!term) {
      toast.error('Please enter a reference number');
      setFilteredTransactions([]);
      return;
    }

    const result = transactions.filter((t) => {
      const noteReference = extractReferenceFromNotes(t.notes);
      return noteReference && noteReference.includes(term);
    });
    
    if (result.length === 0) {
      toast.error('No payment found with this reference number');
    }

    setFilteredTransactions(result);
    setCurrentPage(1);
  };

  const handleSaveEdit = async () => {
    if (!editTransaction) return;

    try {
      const { error } = await supabase
        .from('bill_transactions')
        .update({
          amount: editTransaction.amount,
          transaction_type: editTransaction.transaction_type,
          payment_date: editTransaction.payment_date,
          payment_mode: editTransaction.payment_mode,
          notes: editTransaction.notes,
        })
        .eq('id', editTransaction.id);

      if (error) throw error;

      setFilteredTransactions((prev) =>
        prev.map((t) => (t.id === editTransaction.id ? { ...editTransaction } : t))
      );
      setEditTransaction(null);
      toast.success('Transaction updated successfully');

      if (onUpdate) onUpdate();
      try {
        window.dispatchEvent(new Event('refresh-mahajans'));
      } catch {
        // no-op
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update transaction');
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this transaction?');
    if (!confirmDelete) return;

    try {
      setDeleteLoading(true);
      const { error } = await supabase.from('bill_transactions').delete().eq('id', transaction.id);
      if (error) throw error;

      setFilteredTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
      toast.success('Transaction deleted successfully');

      if (onUpdate) onUpdate();
      try {
        window.dispatchEvent(new Event('refresh-mahajans'));
      } catch {
        // no-op
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const handleReset = () => {
    setSearchTerm('');
    setFilteredTransactions([]);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Enter 8-digit payment reference number"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>Search</Button>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {filteredTransactions.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    {extractReferenceFromNotes(t.notes) || '—'}
                  </TableCell>
                  <TableCell>₹{t.amount.toFixed(2)}</TableCell>
                  <TableCell>{t.transaction_type}</TableCell>
                  <TableCell>{t.payment_date}</TableCell>
                  <TableCell>{t.payment_mode}</TableCell>
                  <TableCell>{t.notes || '—'}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setEditTransaction(t)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(t)}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredTransactions.length > itemsPerPage && (
            <div className="flex justify-between items-center pt-4">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <p>
                Page {currentPage} of {totalPages}
              </p>
              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-muted-foreground pt-6">
          No transactions to display. Enter a payment reference number to find all transactions from that payment.
        </p>
      )}

      <Dialog open={!!editTransaction} onOpenChange={() => setEditTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the details of this transaction and save changes.
            </DialogDescription>
          </DialogHeader>

          {editTransaction && (
            <div className="space-y-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={editTransaction.amount}
                  onChange={(e) =>
                    setEditTransaction({
                      ...editTransaction,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <Label>Transaction Type</Label>
                <select
                  className="border rounded-md px-2 py-1 w-full"
                  value={editTransaction.transaction_type}
                  onChange={(e) =>
                    setEditTransaction({
                      ...editTransaction,
                      transaction_type: e.target.value as 'principal' | 'interest' | 'mixed',
                    })
                  }
                >
                  <option value="principal">Principal</option>
                  <option value="interest">Interest</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div>
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={editTransaction.payment_date}
                  onChange={(e) =>
                    setEditTransaction({ ...editTransaction, payment_date: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Payment Mode</Label>
                <select
                  className="border rounded-md px-2 py-1 w-full"
                  value={editTransaction.payment_mode}
                  onChange={(e) =>
                    setEditTransaction({ ...editTransaction, payment_mode: e.target.value as 'bank' | 'cash' })
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  type="text"
                  value={editTransaction.notes || ''}
                  onChange={(e) =>
                    setEditTransaction({ ...editTransaction, notes: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setEditTransaction(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchTransactionById;
