import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AddAdmissionEnquiryDialog({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    child_name: "",
    parents_name: "",
    date_of_birth: "",
    age: "",
    gender: "",
    address: "",
    nearby_road_name: "",
    mobile_no: "",
    referred_by: "",
    religion: "",
    nationality: "INDIAN",
    course_name: "",
    status: "pending",
    enquiry_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("admission_enquiry").insert([{
        user_id: user.id,
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        date_of_birth: formData.date_of_birth || null,
        enquiry_date: formData.enquiry_date
      }]);

      if (error) throw error;

      toast.success("Admission enquiry added successfully");
      setOpen(false);
      setFormData({
        child_name: "",
        parents_name: "",
        date_of_birth: "",
        age: "",
        gender: "",
        address: "",
        nearby_road_name: "",
        mobile_no: "",
        referred_by: "",
        religion: "",
        nationality: "INDIAN",
        course_name: "",
        status: "pending",
        enquiry_date: new Date().toISOString().split('T')[0]
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Admission Enquiry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Admission Enquiry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="enquiry_date">Enquiry Date *</Label>
            <Input
              id="enquiry_date"
              type="date"
              value={formData.enquiry_date}
              onChange={(e) => setFormData({ ...formData, enquiry_date: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="child_name">Child Name *</Label>
              <Input
                id="child_name"
                required
                value={formData.child_name}
                onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parents_name">Parents Name *</Label>
              <Input
                id="parents_name"
                required
                value={formData.parents_name}
                onChange={(e) => setFormData({ ...formData, parents_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile_no">Mobile No. *</Label>
              <Input
                id="mobile_no"
                required
                value={formData.mobile_no}
                onChange={(e) => setFormData({ ...formData, mobile_no: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="religion">Religion</Label>
              <Input
                id="religion"
                value={formData.religion}
                onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
              />
            </div>
           <div style={{ display: 'none' }}>
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referred_by">Referred By</Label>
              <Input
                id="referred_by"
                value={formData.referred_by}
                onChange={(e) => setFormData({ ...formData, referred_by: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course_name">Class Name</Label>
              <Input
                id="course_name"
                value={formData.course_name}
                onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nearby_road_name">Nearby / Road Name</Label>
            <Input
              id="nearby_road_name"
              value={formData.nearby_road_name}
              onChange={(e) => setFormData({ ...formData, nearby_road_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="admitted">Admitted</SelectItem>
                <SelectItem value="not_admitted">Not Admitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Enquiry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
