import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ChequeReminder {
  id: string;
  cheque_number: string;
  cheque_date: string;
  amount: number;
  bank_name: string;
  status: string;
  type: "received" | "issued";
  party_name: string | null;
  mahajan_name: string | null;
  days_pending: number;
}

interface ChequeReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChequeReminderDialog({ open, onOpenChange }: ChequeReminderDialogProps) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ChequeReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const daysThreshold = 3; // Show reminders for cheques pending more than 3 days

  useEffect(() => {
    if (open && user) {
      fetchReminders();
    }
  }, [open, user]);

  const fetchReminders = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cheques")
        .select(`
          *,
          mahajans (
            name
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"]);

      if (error) throw error;

      const today = new Date();
      const remindersData = data
        ?.map((cheque) => {
          const daysPending = differenceInDays(today, new Date(cheque.cheque_date));
          return {
            id: cheque.id,
            cheque_number: cheque.cheque_number,
            cheque_date: cheque.cheque_date,
            amount: cheque.amount,
            bank_name: cheque.bank_name,
            status: cheque.status,
            type: cheque.type,
            party_name: cheque.party_name,
            mahajan_name: cheque.mahajans?.name || null,
            days_pending: daysPending,
          };
        })
        .filter((cheque) => cheque.days_pending >= daysThreshold)
        .sort((a, b) => b.days_pending - a.days_pending) || [];

      setReminders(remindersData);
    } catch (error) {
      console.error("Error fetching reminders:", error);
    } finally {
      setLoading(false);
    }
  };

  const receivedCheques = reminders.filter((r) => r.type === "received");
  const issuedCheques = reminders.filter((r) => r.type === "issued");

  const getDaysColorClass = (days: number) => {
    if (days >= 7) return "text-destructive font-semibold";
    if (days >= 5) return "text-orange-600 font-medium";
    return "text-yellow-600";
  };

  if (loading || reminders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Cheque Reminders
          </DialogTitle>
          <DialogDescription>
            You have {reminders.length} cheque{reminders.length !== 1 ? "s" : ""} pending for more than {daysThreshold} days
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {receivedCheques.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Received Cheques ({receivedCheques.length})
                </Badge>
              </h3>
              <div className="space-y-2">
                {receivedCheques.map((cheque) => (
                  <div
                    key={cheque.id}
                    className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{cheque.cheque_number}</span>
                          <Badge variant={cheque.status === "pending" ? "secondary" : "default"}>
                            {cheque.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cheque.party_name || "N/A"} • {cheque.bank_name}
                        </div>
                        <div className="text-sm">
                          Date: {new Date(cheque.cheque_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{cheque.amount.toLocaleString()}</div>
                        <div className={`text-sm ${getDaysColorClass(cheque.days_pending)}`}>
                          {cheque.days_pending} days pending
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {issuedCheques.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Issued Cheques ({issuedCheques.length})
                </Badge>
              </h3>
              <div className="space-y-2">
                {issuedCheques.map((cheque) => (
                  <div
                    key={cheque.id}
                    className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{cheque.cheque_number}</span>
                          <Badge variant={cheque.status === "pending" ? "secondary" : "default"}>
                            {cheque.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cheque.mahajan_name || "N/A"} • {cheque.bank_name}
                        </div>
                        <div className="text-sm">
                          Date: {new Date(cheque.cheque_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{cheque.amount.toLocaleString()}</div>
                        <div className={`text-sm ${getDaysColorClass(cheque.days_pending)}`}>
                          {cheque.days_pending} days pending
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button onClick={() => {
            onOpenChange(false);
            window.location.href = "/cheques";
          }}>
            View All Cheques
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
