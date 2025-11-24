import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Eye, Home } from "lucide-react"; // Added Home icon
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
// Assuming these components exist and handle the form logic
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

// Helper component for striped rows and hover effect
// NOTE: Shadcn's TableRow usually handles a hover background, but we need to override it 
// for the stripe effect.
const StripedTableRow = ({ task, index, getStatusBadge, navigate, setEditingTask, deleteMutation }: {
    task: Order;
    index: number;
    getStatusBadge: (status: string) => JSX.Element;
    navigate: (path: string) => void;
    setEditingTask: (task: Order) => void;
    deleteMutation: any;
}) => {
    // Determine the background color for alternating rows
    const baseClassName = index % 2 === 0 
        ? "bg-white hover:bg-gray-50 transition-colors duration-150" 
        : "bg-gray-50 hover:bg-gray-100 transition-colors duration-150";

    return (
        <TableRow className={baseClassName}>
            <TableCell className="font-semibold text-gray-700">{task.order_number}</TableCell>
            <TableCell className="font-medium text-gray-800">{task.title}</TableCell>
            <TableCell className="text-sm text-gray-600">
                {format(new Date(task.order_date), "dd MMM yyyy")}
            </TableCell>
            <TableCell>{getStatusBadge(task.status)}</TableCell>
            <TableCell className="max-w-xs truncate text-gray-600">
                {task.description || "-"}
            </TableCell>
            <TableCell className="max-w-xs truncate text-gray-600">
                {task.notes || "-"}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        title="View Details"
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="text-blue-600 hover:bg-blue-50"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        title="Edit Task"
                        onClick={() => setEditingTask(task)}
                        className="text-yellow-600 hover:bg-yellow-50"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        title="Delete Task"
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete Task #${task.order_number}?`)) {
                                deleteMutation.mutate(task.id);
                            }
                        }}
                        className="text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};


const TaskManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Order | null>(null);

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
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

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
    // Enhanced variant mapping for more vibrant status colors
    const variants: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      processing: "bg-blue-100 text-blue-800 border-blue-300",
      completed: "bg-green-100 text-green-800 border-green-300",
      delivered: "bg-green-100 text-green-800 border-green-300",
    };
    
    // Use the custom class for the Badge component
    return (
      <Badge className={`px-2 py-1 font-medium ${variants[status] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-semibold text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-8 space-y-8 bg-white min-h-screen">
      
      {/* HEADER ROW */}
      <div className="flex justify-between items-center border-b pb-4">
        
        {/* Title and Subtitle */}
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900">
            Task Dashboard
          </h1>
          <p className="text-lg text-gray-500 mt-1">
            Manage your operational tasks and order details efficiently.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
            <Button 
                variant="outline" 
                onClick={() => navigate("/")} // Navigate to home path
                className="text-gray-700 hover:bg-gray-100 border-gray-300 shadow-sm"
            >
                <Home className="h-4 w-4 mr-2" />
                Back to Home
            </Button>
            <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 transition-colors shadow-md"
            >
                <Plus className="h-4 w-4 mr-2" />
                Add New Task
            </Button>
        </div>
      </div>

      {/* MAIN CARD: TASK TABLE */}
      <Card className="shadow-2xl border-t-4 border-blue-500/50">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-2xl font-semibold text-gray-800">Task List ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0"> {/* P-0 to ensure table is edge-to-edge */}
          {tasks.length === 0 ? (
            <div className="text-center py-16 text-xl text-gray-500">
              <p>No tasks found.</p>
              <p className="mt-2 text-base">Click "Add New Task" to begin managing your tasks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto"> {/* Ensures responsiveness */}
                <Table>
                  <TableHeader className="bg-gray-100 border-b border-gray-200">
                    <TableRow className="hover:bg-gray-100">
                      <TableHead className="w-[100px] font-bold text-gray-700">Task #</TableHead>
                      <TableHead className="font-bold text-gray-700">Title</TableHead>
                      <TableHead className="w-[120px] font-bold text-gray-700">Date</TableHead>
                      <TableHead className="w-[120px] font-bold text-gray-700">Status</TableHead>
                      <TableHead className="font-bold text-gray-700">Description</TableHead>
                      <TableHead className="font-bold text-gray-700">Notes</TableHead>
                      <TableHead className="text-right w-[120px] font-bold text-gray-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task, index) => (
                        <StripedTableRow 
                            key={task.id} 
                            task={task} 
                            index={index}
                            getStatusBadge={getStatusBadge}
                            navigate={navigate}
                            setEditingTask={setEditingTask}
                            deleteMutation={deleteMutation}
                        />
                    ))}
                  </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOGS */}
      <AddTaskDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

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
