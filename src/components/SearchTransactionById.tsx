import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  bill_id: string;
  amount: number;
  transaction_type: 'principal' | 'interest' | 'mixed';
  payment_date: string;
  payment_mode: 'bank' | 'cash';
  notes?: string;
}

const SearchTransactionById = ({ transactions }: { transactions: Transaction[] }) => {
  const [searchId, setSearchId] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // 🔍 Search by Primary Key (id)
  const handleSearch = () => {
    const idTerm = searchId.trim();
    if (!idTerm) {
      toast.error('Please enter a transaction ID to search');
      setFilteredTransactions([]);
      return;
    }

    const result = transactions.filter((t) => t.id.toLowerCase() === idTerm.toLowerCase());

    if (result.length === 0) toast.error('No matching transactions found');

    setFilteredTransactions(result);
    setCurrentPage(1);
  };

  // 💾 Save edited transaction
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
          // updated_at: new Date().toISOString(),
        })
        .eq('id', editTransaction.id);

      if (error) throw error;

      setFilteredTransactions((prev) =>
        prev.map((t) => (t.id === editTransaction.id ? { ...editTransaction } : t))
      );
      setEditTransaction(null);
      toast.success('Transaction updated successfully');

      // Notify other components (MahajanList) to refresh balances / data
      try {
        window.dispatchEvent(new Event('refresh-mahajans'));
      } catch {
        // no-op in non-browser environments
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update transaction');
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const handleReset = () => {
    setSearchId('');
    setFilteredTransactions([]);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 🔍 Search */}
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Search by Transaction ID"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
        />
        <Button onClick={handleSearch}>Search</Button>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {/* 📋 Table */}
      {filteredTransactions.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Bill ID</TableHead>
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
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.bill_id}</TableCell>
                  <TableCell>₹{t.amount.toFixed(2)}</TableCell>
                  <TableCell>{t.transaction_type}</TableCell>
                  <TableCell>{t.payment_date}</TableCell>
                  <TableCell>{t.payment_mode}</TableCell>
                  <TableCell>{t.notes || '—'}</TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setEditTransaction(t)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
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
        <p className="text-center text-gray-500 pt-6">
          No transactions to display. Please search using a transaction ID.
        </p>
      )}

      {/* ✏️ Edit Modal */}
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
                    setEditTransaction({ ...editTransaction, payment_mode: e.target.value as 'cash' | 'bank' })
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