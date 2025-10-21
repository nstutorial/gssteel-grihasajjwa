import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Bill {
  id: string;
  bill_number?: string;
  bill_amount: number;
  interest_rate?: number;
  interest_type?: 'daily' | 'monthly' | 'none';
  bill_date: string;
  due_date?: string;
  description?: string;
}

const SearchBillbyRef = ({ bills }: { bills: Bill[] }) => {
  const [reference, setReference] = useState('');
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]); // 🔹 Empty initially
  const [currentPage, setCurrentPage] = useState(1);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const itemsPerPage = 5;

  // 🔍 Search by Bill Number or ID
  const handleSearch = () => {
    const searchTerm = reference.trim().toLowerCase();

    if (searchTerm === '') {
      toast.error('Please enter a bill number or ID to search');
      setFilteredBills([]);
      return;
    }

    const result = bills.filter(
      (b) =>
        (b.bill_number && b.bill_number.toLowerCase().includes(searchTerm)) ||
        b.id.toLowerCase().includes(searchTerm)
    );

    if (result.length === 0) {
      toast.error('No matching bills found');
    }

    setFilteredBills(result);
    setCurrentPage(1);
  };

  // 🧾 Delete a bill
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;

    try {
      const { error } = await supabase.from('bills').delete().eq('id', id);
      if (error) throw error;

      setFilteredBills((prev) => prev.filter((b) => b.id !== id));
      toast.success('Bill deleted successfully');

      // notify mahajan list to refresh data/balances
      try {
        window.dispatchEvent(new Event('refresh-mahajans'));
      } catch {
        // noop for non-browser envs
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete bill');
    }
  };

  // 💾 Save edited bill
  const handleSaveEdit = async () => {
    if (!editBill) return;

    try {
      const { error } = await supabase
        .from('bills')
        .update({
          bill_amount: editBill.bill_amount,
          interest_rate: editBill.interest_rate,
          interest_type: editBill.interest_type,
          bill_date: editBill.bill_date,
          due_date: editBill.due_date,
          description: editBill.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editBill.id);

      if (error) throw error;

      setFilteredBills((prev) =>
        prev.map((b) => (b.id === editBill.id ? { ...editBill } : b))
      );
      setEditBill(null);
      toast.success('Bill updated successfully');

      // notify mahajan list to refresh data/balances
      try {
        window.dispatchEvent(new Event('refresh-mahajans'));
      } catch {
        // noop for non-browser envs
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update bill');
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBills = filteredBills.slice(startIndex, startIndex + itemsPerPage);

  const handleReset = () => {
    setReference('');
    setFilteredBills([]); // 🔹 Hide all bills
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* 🔍 Search input and buttons */}
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Search by Reference Number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <Button onClick={handleSearch}>Search</Button>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
      </div>

      {/* 📋 Table - only visible after search */}
      {filteredBills.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Interest Type</TableHead>
                <TableHead>Interest Rate</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Bill Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell>{bill.bill_number || '—'}</TableCell>
                  <TableCell>₹{bill.bill_amount.toFixed(2)}</TableCell>
                  <TableCell>{bill.interest_type || 'none'}</TableCell>
                  <TableCell>{bill.interest_rate ?? 0}%</TableCell>
                  <TableCell>{bill.description || '—'}</TableCell>
                  <TableCell>{bill.bill_date}</TableCell>
                  <TableCell>{bill.due_date || '—'}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" onClick={() => setEditBill(bill)}>
                      Edit
                    </Button>
                    {/* <Button variant="destructive" onClick={() => handleDelete(bill.id)}>
                      Delete
                    </Button> */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination controls */}
          {filteredBills.length > itemsPerPage && (
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
          No bills to display. Please search using a bill number or ID.
        </p>
      )}

      {/* ✏️ Edit Modal */}
      <Dialog open={!!editBill} onOpenChange={() => setEditBill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
          </DialogHeader>

          {editBill && (
            <div className="space-y-4">
              <div>
                <Label>Bill Amount</Label>
                <Input
                  type="number"
                  value={editBill.bill_amount}
                  onChange={(e) =>
                    setEditBill({
                      ...editBill,
                      bill_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  value={editBill.interest_rate ?? 0}
                  onChange={(e) =>
                    setEditBill({
                      ...editBill,
                      interest_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Interest Type</Label>
                <select
                  className="border rounded-md px-2 py-1 w-full"
                  value={editBill.interest_type || 'none'}
                  onChange={(e) =>
                    setEditBill({
                      ...editBill,
                      interest_type: e.target.value as 'daily' | 'monthly' | 'none',
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <Label>Bill Date</Label>
                <Input
                  type="date"
                  value={editBill.bill_date || ''}
                  onChange={(e) =>
                    setEditBill({ ...editBill, bill_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={editBill.due_date || ''}
                  onChange={(e) =>
                    setEditBill({ ...editBill, due_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  type="text"
                  value={editBill.description || ''}
                  onChange={(e) =>
                    setEditBill({ ...editBill, description: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setEditBill(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchBillbyRef;