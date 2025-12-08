import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, FileText, User, Calendar, CheckCircle, Clock, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import UploadModal from "@/components/submissions/upload-modal";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Submissions() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const assignmentFromQuery = searchParams.get('assignment') || "all";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<string>(assignmentFromQuery);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [exportDate, setExportDate] = useState<Date | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/submissions/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Submission deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      });
    },
  });

  interface Assignment {
    id: string;
    title: string;
  }

  interface Submission {
    id: string;
    assignmentId: string;
    studentName: string;
    studentId: string;
    content: string;
    fileName?: string;
    submittedAt: string;
    isGraded: boolean;
    assignmentTitle?: string;
  }

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  // Fetch submissions for the selected assignment
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ["/api/assignments", selectedAssignment, "submissions"],
    queryFn: async () => {
      if (selectedAssignment === "all") {
        // Fetch submissions for all assignments
        const allSubmissions = [];
        if (assignments) {
          for (const assignment of assignments) {
            const response = await fetch(`/api/assignments/${assignment.id}/submissions`, {
              credentials: "include",
            });
            if (response.ok) {
              const assignmentSubmissions = await response.json();
              // Add assignment info to each submission
              assignmentSubmissions.forEach((sub: any) => {
                sub.assignmentTitle = assignment.title;
              });
              allSubmissions.push(...assignmentSubmissions);
            }
          }
        }
        return allSubmissions;
      } else {
        // Fetch submissions for specific assignment
        const response = await fetch(`/api/assignments/${selectedAssignment}/submissions`, {
          credentials: "include",
        });
        if (response.ok) {
          const assignmentSubmissions = await response.json();
          const assignment = assignments?.find(a => a.id === selectedAssignment);
          if (assignment) {
            assignmentSubmissions.forEach((sub: any) => {
              sub.assignmentTitle = assignment.title;
            });
          }
          return assignmentSubmissions;
        }
        return [];
      }
    },
    enabled: !!assignments,
  });

  // Filter submissions based on search query
  const filteredSubmissions = submissions?.filter((submission: Submission) =>
    submission.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    submission.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (submission.assignmentTitle && submission.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const getStatusIcon = (isGraded: boolean) => {
    if (isGraded) {
      return <CheckCircle className="h-4 w-4 text-accent" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (isGraded: boolean) => {
    if (isGraded) {
      return <Badge className="bg-accent/10 text-accent">Graded</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const fetchExportData = async () => {
    const params = new URLSearchParams();
    if (exportDate) {
      params.set("date", format(exportDate, "yyyy-MM-dd"));
    }
    if (selectedAssignment !== "all") {
      params.set("assignmentId", selectedAssignment);
    }
    
    const response = await fetch(`/api/export/submissions?${params.toString()}`, {
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch export data");
    }
    
    return response.json();
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const data = await fetchExportData();
      
      if (data.length === 0) {
        toast({
          title: "No Data",
          description: "No submissions found for the selected criteria.",
          variant: "destructive",
        });
        return;
      }

      const headers = ["Assignment", "Student Name", "Student ID", "File Name", "Submitted At", "Status", "Grade", "Score", "Max Score", "Percentage", "Feedback"];
      const rows = data.map((item: any) => [
        item.assignmentTitle,
        item.studentName,
        item.studentId,
        item.fileName || "Text submission",
        new Date(item.submittedAt).toLocaleString(),
        item.isGraded ? "Graded" : "Pending",
        item.grade || "N/A",
        item.score || "N/A",
        item.maxScore || "N/A",
        item.percentage ? `${item.percentage}%` : "N/A",
        item.feedback || "Not graded yet",
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `submissions_${exportDate ? format(exportDate, "yyyy-MM-dd") : "all"}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${data.length} submissions to Excel/CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToWord = async () => {
    setIsExporting(true);
    try {
      const data = await fetchExportData();
      
      if (data.length === 0) {
        toast({
          title: "No Data",
          description: "No submissions found for the selected criteria.",
          variant: "destructive",
        });
        return;
      }

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Submissions Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .submission { margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .submission-header { font-size: 18px; font-weight: bold; color: #222; margin-bottom: 10px; }
            .field { margin: 5px 0; }
            .label { font-weight: bold; color: #555; }
            .grade { font-size: 24px; font-weight: bold; color: #2563eb; }
            .feedback { background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Submissions Report${exportDate ? ` - ${format(exportDate, "MMMM d, yyyy")}` : ""}</h1>
      `;

      for (const item of data) {
        htmlContent += `
          <div class="submission">
            <div class="submission-header">${item.studentName} (${item.studentId})</div>
            <div class="field"><span class="label">Assignment:</span> ${item.assignmentTitle}</div>
            <div class="field"><span class="label">File:</span> ${item.fileName || "Text submission"}</div>
            <div class="field"><span class="label">Submitted:</span> ${new Date(item.submittedAt).toLocaleString()}</div>
            <div class="field"><span class="label">Status:</span> ${item.isGraded ? "Graded" : "Pending"}</div>
            ${item.isGraded ? `
              <div class="field"><span class="label">Grade:</span> <span class="grade">${item.grade}</span></div>
              <div class="field"><span class="label">Score:</span> ${item.score}/${item.maxScore} (${item.percentage}%)</div>
              <div class="feedback">
                <span class="label">Feedback:</span><br>
                ${item.feedback}
              </div>
            ` : ""}
          </div>
        `;
      }

      htmlContent += `</body></html>`;

      const blob = new Blob([htmlContent], { type: "application/msword" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `submissions_${exportDate ? format(exportDate, "yyyy-MM-dd") : "all"}.doc`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${data.length} submissions to Word document.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-submissions"
            />
          </div>
          
          <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
            <SelectTrigger className="w-48" data-testid="select-filter-assignment">
              <SelectValue placeholder="Filter by assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {assignments?.map((assignment) => (
                <SelectItem key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48" data-testid="button-date-filter">
                <Calendar className="mr-2 h-4 w-4" />
                {exportDate ? format(exportDate, "MMM d, yyyy") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={exportDate}
                onSelect={setExportDate}
                initialFocus
              />
              {exportDate && (
                <div className="p-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setExportDate(undefined)}
                    className="w-full"
                  >
                    Clear date filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="outline" 
            onClick={exportToExcel}
            disabled={isExporting}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          
          <Button 
            variant="outline" 
            onClick={exportToWord}
            disabled={isExporting}
            data-testid="button-export-word"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Word
          </Button>
          
          <Button 
            onClick={() => setLocation('/upload')}
            data-testid="button-upload-submissions-header"
          >
            Upload Submissions
          </Button>
        </div>
      </div>

      {submissionsLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading submissions...</p>
          </CardContent>
        </Card>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No submissions found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Students haven't submitted any work yet, or you haven't created any assignments.
            </p>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setLocation('/upload')}
                data-testid="button-upload-submissions"
              >
                Upload Submissions
              </Button>
              <Button 
                onClick={() => setLocation('/assignments')}
                data-testid="button-create-assignment-from-submissions"
              >
                Create Assignment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((submission: Submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow" data-testid={`card-submission-${submission.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(submission.isGraded)}
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {submission.studentName}
                      </CardTitle>
                    </div>
                    {getStatusBadge(submission.isGraded)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setLocation(`/grading-results?submissionId=${submission.id}`)}
                      data-testid={`button-view-submission-${submission.id}`}
                    >
                      View Details
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-submission-${submission.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this submission from {submission.studentName}? This will also delete the grading result. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSubmissionMutation.mutate(submission.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <User className="mr-2 w-4 h-4" />
                    <span>Student ID: {submission.studentId}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <FileText className="mr-2 w-4 h-4" />
                    <span>{submission.fileName || "Text submission"}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 w-4 h-4" />
                    <span>Submitted {new Date(submission.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <UploadModal 
        open={uploadModalOpen} 
        onOpenChange={setUploadModalOpen} 
      />
    </div>
  );
}
