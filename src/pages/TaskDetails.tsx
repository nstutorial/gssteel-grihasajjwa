import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, FileText, Clock, Share2, MessageCircle } from "lucide-react"; 
import { format } from "date-fns";

interface Task {
  id: string;
  order_number: string;
  title: string;
  description: string | null;
  order_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const TaskDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      if (!user?.id || !id) return null;
      
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data as Task;
    },
    enabled: !!user?.id && !!id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      completed: "outline",
      delivered: "outline",
    };

    return (
      <Badge 
        variant={variants[status] || "secondary"} 
        className="text-sm px-3 py-1 font-medium bg-opacity-80"
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  /**
   * Constructs the WhatsApp share text with markdown formatting and opens the share link.
   * WhatsApp formatting uses: *bold*, _italic_, ~strikethrough~.
   */
  const handleShare = () => {
    if (!task) return;

    // Construct the formatted message for WhatsApp
    const orderDateFormatted = format(new Date(task.order_date), "dd MMM yyyy");
    const statusFormatted = task.status.charAt(0).toUpperCase() + task.status.slice(1);
    
    const message = `
*📢 New Task Details!* ---------------------------------
*Order No:* #${task.order_number}
*Title:* ${task.title}
*Status:* ${statusFormatted}
_Scheduled Date:_ ${orderDateFormatted}
    
${task.description ? `*Description:*\n${task.description}` : ''}
${task.notes ? `\n_Notes: ${task.notes}_` : ''}

_Check it out in the app!_
    `;

    // URL-encode the message and construct the WhatsApp deep link
    const encodedMessage = encodeURIComponent(message.trim());
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    // Open the WhatsApp share link
    window.open(whatsappUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-semibold text-gray-500">Loading task details...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-bold text-red-600">Task not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-8 space-y-8 bg-gray-50 min-h-screen"> 
      
      <div className="flex items-center justify-start">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/tasks")}
          className="hover:bg-gray-200 transition-colors duration-200 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>

      <Card className="shadow-2xl border-t-4 border-blue-500 transition-shadow duration-300 hover:shadow-3xl"> 
        <CardHeader className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-3">
            <div>
              <CardTitle className="text-3xl font-extrabold text-gray-800 mb-1">
                Task #{task.order_number}
              </CardTitle>
              <p className="text-lg font-medium text-blue-600">
                {task.title}
              </p>
            </div>
            {getStatusBadge(task.status)}
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-8">
          
          {/* Share Button Section */}
          <div className="flex justify-end">
            <Button onClick={handleShare} className="bg-green-500 hover:bg-green-600 transition-colors duration-200 shadow-md">
                <MessageCircle className="h-5 w-5 mr-2" />
                Share via WhatsApp
            </Button>
          </div>

          {/* Metadata Section (Date and Creation Time) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 border rounded-lg bg-gray-50">
            
            {/* Task Date */}
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-blue-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-700 text-sm mb-1">Task Date</h3>
                <p className="text-gray-900 text-md font-medium">
                  {format(new Date(task.order_date), "dd MMMM yyyy")}
                </p>
              </div>
            </div>

            {/* Created At */}
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6 text-green-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-700 text-sm mb-1">Created At</h3>
                <p className="text-gray-900 text-md font-medium">
                  {format(new Date(task.created_at), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            </div>
          </div>

          {/* Description Section with Light BG Color */}
          {task.description && (
            <div className="border-l-4 border-yellow-400 pl-4 py-3 rounded-md bg-yellow-50"> 
              {/* Added bg-yellow-50 for light background */}
              <div className="flex items-center mb-3">
                <FileText className="h-5 w-5 mr-2 text-yellow-600" />
                <h3 className="font-bold text-gray-800 text-lg">Description</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Notes Section */}
          {task.notes && (
            <div className="border-l-4 border-purple-400 pl-4 py-1">
              <div className="flex items-center mb-3">
                <FileText className="h-5 w-5 mr-2 text-purple-600" />
                <h3 className="font-bold text-gray-800 text-lg">Notes / Remarks</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed italic">
                {task.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskDetails;
