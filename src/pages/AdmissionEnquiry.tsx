import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useControl } from "@/contexts/ControlContext";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AddAdmissionEnquiryDialog } from "@/components/AddAdmissionEnquiryDialog";
import { EditAdmissionEnquiryDialog } from "@/components/EditAdmissionEnquiryDialog";
import { AddFollowupDialog } from "@/components/AddFollowupDialog";
import { toast } from "sonner";
import { Pencil, Trash2, Phone, Search, AlertCircle, ChevronDown, ChevronRight, Download, ArrowLeft } from "lucide-react";
import jsPDF from "jspdf";
import { PDFDownloader } from "@/lib/pdf-download";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdmissionEnquiry() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingEnquiry, setEditingEnquiry] = useState<any>(null);
  const [followupEnquiryId, setFollowupEnquiryId] = useState<string | null>(null);
  const [deleteEnquiryId, setDeleteEnquiryId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { allowAdmissionDeletion } = useControl().settings;

  const fetchEnquiries = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: enquiriesData, error: enquiriesError } = await supabase
        .from("admission_enquiry")
        .select("*")
        .eq("user_id", user.id)
        .order("enquiry_date", { ascending: false });

      if (enquiriesError) throw enquiriesError;

      // Fetch all follow-ups for each enquiry
      const enquiriesWithFollowups = await Promise.all(
        (enquiriesData || []).map(async (enquiry) => {
          const { data: followups } = await supabase
            .from("admission_followups")
            .select("*")
            .eq("enquiry_id", enquiry.id)
            .order("followup_date", { ascending: false });

          return {
            ...enquiry,
            last_followup: followups?.[0] || null,
            all_followups: followups || [],
          };
        })
      );

      setEnquiries(enquiriesWithFollowups);
      setFilteredEnquiries(enquiriesWithFollowups);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, [user]);

  useEffect(() => {
    let filtered = enquiries;

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.child_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.parents_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.mobile_no?.includes(searchTerm)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    setFilteredEnquiries(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, statusFilter, enquiries]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredEnquiries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEnquiries = filteredEnquiries.slice(startIndex, endIndex);

  const handleDelete = async () => {
    if (!deleteEnquiryId) return;

    try {
      // First delete all followups
      const { error: followupsError } = await supabase
        .from("admission_followups")
        .delete()
        .eq("enquiry_id", deleteEnquiryId);

      if (followupsError) throw followupsError;

      // Then delete the enquiry
      const { error } = await supabase
        .from("admission_enquiry")
        .delete()
        .eq("id", deleteEnquiryId);

      if (error) throw error;

      toast.success("Enquiry deleted successfully");
      fetchEnquiries();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteEnquiryId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "secondary",
      admitted: "default",
      not_admitted: "destructive"
    };
    const labels: any = {
      pending: "Pending",
      admitted: "Admitted",
      not_admitted: "Not Admitted"
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const handleExportPDF = async (enquiry: any) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // School Name
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("SKYVIEW PUBLIC SCHOOL", pageWidth / 2, 20, { align: "center" });
    
    // Title
    pdf.setFontSize(16);
    pdf.text("Admission Enquiry Form", pageWidth / 2, 35, { align: "center" });
    
    // Draw a line
    pdf.setLineWidth(0.5);
    pdf.line(20, 40, pageWidth - 20, 40);
    
    // Form content
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    
    let yPos = 55;
    const leftMargin = 25;
    const lineHeight = 10;
    
    const addField = (label: string, value: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(`${label}:`, leftMargin, yPos);
      pdf.setFont("helvetica", "normal");
      pdf.text(value || "-", leftMargin + 50, yPos);
      yPos += lineHeight;
    };
    
    addField("Enquiry Date", enquiry.enquiry_date ? format(new Date(enquiry.enquiry_date), "dd/MM/yyyy") : "-");
    addField("Child Name", enquiry.child_name);
    addField("Gender", enquiry.gender);
    addField("Date of Birth", enquiry.date_of_birth ? format(new Date(enquiry.date_of_birth), "dd/MM/yyyy") : "-");
    addField("Age", enquiry.age?.toString());
    
    yPos += 5;
    addField("Parents Name", enquiry.parents_name);
    addField("Mobile No", enquiry.mobile_no);
    addField("Address", enquiry.address);
    addField("Nearby Road", enquiry.nearby_road_name);
    
    yPos += 5;
    addField("Religion", enquiry.religion);
    addField("Nationality", enquiry.nationality);
    addField("Course Name", enquiry.course_name);
    addField("Referred By", enquiry.referred_by);
    
    yPos += 5;
    addField("Status", enquiry.status.replace("_", " ").toUpperCase());
    
    // Last Follow-up section
    if (enquiry.last_followup) {
      yPos += 10;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Last Follow-up", leftMargin, yPos);
      yPos += lineHeight;
      
      pdf.setFontSize(11);
      addField("Date", format(new Date(enquiry.last_followup.followup_date), "dd/MM/yyyy"));
      addField("Type", enquiry.last_followup.followup_type);
      if (enquiry.last_followup.remark) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Remark:", leftMargin, yPos);
        pdf.setFont("helvetica", "normal");
        const remarkLines = pdf.splitTextToSize(enquiry.last_followup.remark, pageWidth - leftMargin - 30);
        pdf.text(remarkLines, leftMargin + 50, yPos);
        yPos += remarkLines.length * lineHeight;
      }
      if (enquiry.last_followup.next_followup_date) {
        addField("Next Follow-up", format(new Date(enquiry.last_followup.next_followup_date), "dd/MM/yyyy"));
      }
    }
    
    // Footer
    const footerY = pdf.internal.pageSize.getHeight() - 20;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "italic");
    pdf.text(`Generated on ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, footerY, { align: "center" });
    
    const pdfBlob = pdf.output("blob");
    const filename = `Admission_Enquiry_${enquiry.child_name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
    await PDFDownloader.downloadPDF(pdfBlob, filename);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Admission Enquiries</h1>
        </div>
        <AddAdmissionEnquiryDialog onSuccess={fetchEnquiries} />
      </div>

      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="admitted">Admitted</SelectItem>
              <SelectItem value="not_admitted">Not Admitted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Child Name</TableHead>
                <TableHead>Parent Name & Address</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Enquiry Date</TableHead>
                <TableHead>Follow-ups</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No enquiries found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEnquiries.map((enquiry: any) => {
                  const isExpanded = expandedRows.has(enquiry.id);
                  return (
                    <Collapsible key={enquiry.id} asChild open={isExpanded} onOpenChange={() => toggleRow(enquiry.id)}>
                      <>
                        <TableRow>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-medium">{enquiry.child_name}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="font-medium">{enquiry.parents_name}</div>
                              {enquiry.address && (
                                <div className="text-sm text-muted-foreground truncate max-w-xs">
                                  {enquiry.address}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{enquiry.mobile_no}</TableCell>
                          <TableCell>
                            {enquiry.enquiry_date ? format(new Date(enquiry.enquiry_date), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {enquiry.last_followup?.followup_date ? (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Last: </span>
                                  <span className="text-foreground font-medium">
                                    {format(new Date(enquiry.last_followup.followup_date), "dd/MM/yyyy")}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">No follow-up yet</div>
                              )}
                              {enquiry.last_followup?.next_followup_date && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Next: </span>
                                  <span className="text-primary font-medium">
                                    {format(new Date(enquiry.last_followup.next_followup_date), "dd/MM/yyyy")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(enquiry.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExportPDF(enquiry)}
                                title="Export PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setFollowupEnquiryId(enquiry.id)}
                                title="Add Follow-up"
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingEnquiry(enquiry)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {allowAdmissionDeletion && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeleteEnquiryId(enquiry.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/50">
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Gender:</span>
                                    <p className="text-sm">{enquiry.gender || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Date of Birth:</span>
                                    <p className="text-sm">{enquiry.date_of_birth ? format(new Date(enquiry.date_of_birth), "dd/MM/yyyy") : "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Age:</span>
                                    <p className="text-sm">{enquiry.age || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Nearby Road:</span>
                                    <p className="text-sm">{enquiry.nearby_road_name || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Religion:</span>
                                    <p className="text-sm">{enquiry.religion || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Nationality:</span>
                                    <p className="text-sm">{enquiry.nationality || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-muted-foreground">Course Name:</span>
                                    <p className="text-sm">{enquiry.course_name || "-"}</p>
                                  </div>
                              <div>
                                <span className="text-sm font-medium text-muted-foreground">Referred By:</span>
                                <p className="text-sm">{enquiry.referred_by || "-"}</p>
                              </div>
                            </div>
                            
                            {enquiry.all_followups && enquiry.all_followups.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <h4 className="text-sm font-semibold mb-3">Follow-up History</h4>
                                <div className="space-y-3">
                                  {enquiry.all_followups.map((followup: any) => (
                                    <div key={followup.id} className="bg-background/50 p-3 rounded-lg border">
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="flex gap-4">
                                          <div>
                                            <span className="text-xs text-muted-foreground">Date:</span>
                                            <p className="text-sm font-medium">{format(new Date(followup.followup_date), "dd/MM/yyyy")}</p>
                                          </div>
                                          <div>
                                            <span className="text-xs text-muted-foreground">Type:</span>
                                            <p className="text-sm">{followup.followup_type}</p>
                                          </div>
                                        </div>
                                        {followup.next_followup_date && (
                                          <div className="text-right">
                                            <span className="text-xs text-muted-foreground">Next Follow-up:</span>
                                            <p className="text-sm text-primary font-medium">
                                              {format(new Date(followup.next_followup_date), "dd/MM/yyyy")}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                      {followup.remark && (
                                        <div>
                                          <span className="text-xs text-muted-foreground">Remark:</span>
                                          <p className="text-sm mt-1 whitespace-pre-wrap">{followup.remark}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {editingEnquiry && (
        <EditAdmissionEnquiryDialog
          enquiry={editingEnquiry}
          open={!!editingEnquiry}
          onOpenChange={(open) => !open && setEditingEnquiry(null)}
          onSuccess={fetchEnquiries}
        />
      )}

      {followupEnquiryId && (
        <AddFollowupDialog
          enquiryId={followupEnquiryId}
          open={!!followupEnquiryId}
          onOpenChange={(open) => !open && setFollowupEnquiryId(null)}
          onSuccess={() => {
            fetchEnquiries();
            toast.success("Followup recorded");
          }}
        />
      )}

      <AlertDialog open={!!deleteEnquiryId} onOpenChange={(open) => !open && setDeleteEnquiryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Enquiry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this enquiry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
