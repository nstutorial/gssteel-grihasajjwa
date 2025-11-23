import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddFollowupDialogProps {
  enquiryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddFollowupDialog({ enquiryId, open, onOpenChange, onSuccess }: AddFollowupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    followup_date: new Date().toISOString().split('T')[0],
    followup_type: "phone",
    remark: "",
    next_followup_date: "",
    status: "unchanged"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error: followupError } = await supabase.from("admission_followups").insert([{
        enquiry_id: enquiryId,
        followup_date: formData.followup_date,
        followup_type: formData.followup_type,
        remark: formData.remark,
        next_followup_date: formData.next_followup_date || null
      }]);

      if (followupError) throw followupError;

      // Update enquiry status if provided
      if (formData.status && formData.status !== "unchanged") {
        const { error: statusError } = await supabase
          .from("admission_enquiry")
          .update({ status: formData.status })
          .eq("id", enquiryId);

        if (statusError) throw statusError;
      }

      toast.success("Followup added successfully");
      onOpenChange(false);
      setFormData({
        followup_date: new Date().toISOString().split('T')[0],
        followup_type: "phone",
        remark: "",
        next_followup_date: "",
        status: "unchanged"
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Followup</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="followup_date">Followup Date *</Label>
            <Input
              id="followup_date"
              type="date"
              required
              value={formData.followup_date}
              onChange={(e) => setFormData({ ...formData, followup_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="followup_type">Followup Type *</Label>
            <Select value={formData.followup_type} onValueChange={(value) => setFormData({ ...formData, followup_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="visit">Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remark">Remark</Label>
            <Textarea
              id="remark"
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_followup_date">Next Followup Date</Label>
            <Input
              id="next_followup_date"
              type="date"
              value={formData.next_followup_date}
              onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Update Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">Keep current status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="admitted">Admitted</SelectItem>
                <SelectItem value="not_admitted">Not Admitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Followup"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
