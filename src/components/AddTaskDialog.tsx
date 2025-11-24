import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddTaskDialog = ({ open, onOpenChange }: AddOrderDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order_date: new Date().toISOString().split("T")[0],
    status: "pending",
    notes: "",
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        ...data,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        order_date: new Date().toISOString().split("T")[0],
        status: "pending",
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    addMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <Label htmlFor="order_date">Task Date</Label>
            <Input
              id="order_date"
              type="date"
              value={formData.order_date}
              onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskDialog;
