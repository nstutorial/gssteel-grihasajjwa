import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Eye, Home } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import AddTaskDialog from "@/components/AddTaskDialog";
import EditTaskDialog from "@/components/EditTaskDialog";

interface Order {
  id: string;
  order_number: string;
  title: string;
  description: string | null;
  order_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 10;

const TaskManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Order | null>(null);
  const [page, setPage] = useState(1);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      pending: "outline",
      processing: "secondary",
      completed: "default",
      delivered: "default",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Pagination logic
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedTasks = tasks.slice(start, end);
  const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 text-center text-lg font-medium">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/** Top Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Task Manager</h1>
          <p className="text-muted-foreground text-sm">
            Manage your tasks and track their status
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate("/")}
            className="flex gap-2"
          >
            <Home className="h-4 w-4" /> Back to Home
          </Button>

          <Button onClick={() => setIsAddDialogOpen(true)} className="flex gap-2">
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      {/** Card Section */}
      <Card className="shadow-lg border border-gray-200 rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl">All Tasks</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-lg">
              No tasks found. Create your first task to get started.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-b-xl">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead>Task #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedTasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {task.order_number}
                      </TableCell>

                      <TableCell>{task.title}</TableCell>

                      <TableCell>
                        {format(new Date(task.order_date), "dd MMM yyyy")}
                      </TableCell>

                      <TableCell>{getStatusBadge(task.status)}</TableCell>

                      <TableCell className="max-w-xs truncate">
                        {task.description || "-"}
                      </TableCell>

                      <TableCell className="max-w-xs truncate">
                        {task.notes || "-"}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/tasks/${task.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTask(task)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this task?"
                                )
                              ) {
                                deleteMutation.mutate(task.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/** Pagination */}
      {tasks.length > 0 && (
        <div className="flex justify-between items-center py-4">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>

          <div className="font-medium">
            Page {page} of {totalPages}
          </div>

          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          order={editingTask}
        />
      )}
    </div>
  );
};

export default TaskManager;
