import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, FileText, User, Calendar, CheckCircle, Clock, Download, FileSpreadsheet, Trash2, Shield, AlertTriangle, Bot, Users, RefreshCw, Mail, GitCompare } from "lucide-react";
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
  const [appliedDateFilter, setAppliedDateFilter] = useState<Date | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);

  const [checkingPlagiarism, setCheckingPlagiarism] = useState<string | null>(null);
  const [plagiarismResults, setPlagiarismResults] = useState<Record<string, any>>({});
  const [crossSimilarityResults, setCrossSimilarityResults] = useState<Record<string, any>>({});
  const [isRunningCrossCheck, setIsRunningCrossCheck] = useState(false);
  const [regrading, setRegrading] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

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

  const checkPlagiarism = async (submissionId: string) => {
    setCheckingPlagiarism(submissionId);
    try {
      const response = await apiRequest("POST", `/api/submissions/${submissionId}/plagiarism-check`);
      const result = await response.json();
      setPlagiarismResults(prev => ({ ...prev, [submissionId]: result }));
      toast({
        title: "Plagiarism Check Complete",
        description: `AI Detection: ${result.isAiGenerated ? "AI Generated" : "Human Written"}, Similarity: ${result.overallSimilarityScore}%`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check plagiarism",
        variant: "destructive",
      });
    } finally {
      setCheckingPlagiarism(null);
    }
  };

  const fetchPlagiarismResult = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/plagiarism`, {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setPlagiarismResults(prev => ({ ...prev, [submissionId]: result }));
      }
    } catch (error) {
      // Result not found is expected for unchecked submissions
    }
  };


  const downloadFile = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/download`, {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({
          title: "Download Failed",
          description: err.message || "Could not download file.",
          variant: "destructive",
        });
        return;
      }
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch ? fileNameMatch[1] : "submission";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Download Failed",
        description: "An error occurred while downloading the file.",
        variant: "destructive",
      });
    }
  };

  const regradeSubmission = async (submissionId: string) => {
    setRegrading(submissionId);
    try {
      const response = await apiRequest("POST", `/api/submissions/${submissionId}/regrade`);
      const result = await response.json();
      toast({
        title: "Regrading Complete",
        description: `New grade: ${result.result.grade} (${result.result.score}/${result.result.maxScore})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    } catch (error: any) {
      toast({
        title: "Regrade Failed",
        description: error?.message || "Failed to regrade submission",
        variant: "destructive",
      });
    } finally {
      setRegrading(null);
    }
  };

  const sendEvaluationEmail = async (submissionId: string) => {
    setSendingEmail(submissionId);
    try {
      const response = await apiRequest("POST", `/api/submissions/${submissionId}/email-evaluation`);
      const result = await response.json();
      toast({
        title: "Email Sent",
        description: result.message,
      });
    } catch (error: any) {
      toast({
        title: "Email Failed",
        description: error?.message || "Failed to send evaluation email",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(null);
    }
  };

  interface Assignment {
    id: string;
    title: string;
  }

  interface Submission {
    id: string;
    assignmentId: string;
    studentName: string;
    studentId: string;
    studentEmail?: string;
    content: string;
    fileName?: string;
    rawFileData?: string;
    submittedAt: string;
    isGraded: boolean;
    assignmentTitle?: string;
  }

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  // Fetch all submissions in one fast query
  const { data: allSubmissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ["/api/submissions/all"],
    refetchInterval: 15000,
  });

  // Fetch all cross-assignment flags for the college in one batch call
  const { data: crossFlagsData } = useQuery({
    queryKey: ["/api/cross-similarity/flagged"],
    refetchInterval: 30000,
  });

  // Convert the array of flags into a map keyed by submissionId
  useEffect(() => {
    if (Array.isArray(crossFlagsData)) {
      const map: Record<string, any> = {};
      crossFlagsData.forEach((flag: any) => { map[flag.submissionId] = flag; });
      setCrossSimilarityResults(map);
    }
  }, [crossFlagsData]);

  // Filter by selected assignment on the client side
  const submissions = selectedAssignment === "all" 
    ? allSubmissions 
    : allSubmissions.filter((sub: Submission) => sub.assignmentId === selectedAssignment);

  // Filter submissions based on search query and date filter
  const filteredSubmissions = submissions?.filter((submission: Submission) => {
    // Text search filter
    const matchesSearch = submission.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (submission.studentEmail && submission.studentEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (submission.assignmentTitle && submission.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Date filter - use local timezone for comparison
    if (appliedDateFilter) {
      const subDate = new Date(submission.submittedAt);
      const submissionDate = `${subDate.getFullYear()}-${String(subDate.getMonth() + 1).padStart(2, '0')}-${String(subDate.getDate()).padStart(2, '0')}`;
      const filterDate = format(appliedDateFilter, "yyyy-MM-dd");
      return matchesSearch && submissionDate === filterDate;
    }
    
    return matchesSearch;
  }) || [];

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

      const baseUrl = window.location.origin;
      const headers = ["Assignment", "Student Name", "Student ID", "Student Email", "File Name", "File Download Link", "Submitted At", "Status", "Grade", "Score", "Max Score", "Percentage", "Feedback"];
      const rows = data.map((item: any) => [
        item.assignmentTitle,
        item.studentName,
        item.studentId,
        item.studentEmail || "N/A",
        item.fileName || "Text submission",
        item.hasFile ? `${baseUrl}/api/submissions/${item.id}/download` : "N/A",
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

      const baseUrl = window.location.origin;
      for (const item of data) {
        const downloadLink = item.hasFile ? `${baseUrl}/api/submissions/${item.id}/download` : null;
        htmlContent += `
          <div class="submission">
            <div class="submission-header">${item.studentName} (${item.studentId})</div>
            <div class="field"><span class="label">Assignment:</span> ${item.assignmentTitle}</div>
            ${item.studentEmail ? `<div class="field"><span class="label">Email:</span> ${item.studentEmail}</div>` : ""}
            <div class="field"><span class="label">File:</span> ${item.fileName || "Text submission"}${downloadLink ? ` (<a href="${downloadLink}">Download</a>)` : ""}</div>
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
                {appliedDateFilter ? format(appliedDateFilter, "MMM d, yyyy") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={exportDate}
                onSelect={setExportDate}
                initialFocus
              />
              <div className="p-2 border-t space-y-2">
                <Button 
                  size="sm" 
                  onClick={() => {
                    setAppliedDateFilter(exportDate);
                  }}
                  className="w-full"
                  disabled={!exportDate}
                  data-testid="button-apply-date-filter"
                >
                  Apply Filter
                </Button>
                {(exportDate || appliedDateFilter) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setExportDate(undefined);
                      setAppliedDateFilter(undefined);
                    }}
                    className="w-full"
                    data-testid="button-clear-date-filter"
                  >
                    Clear date filter
                  </Button>
                )}
              </div>
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
            variant="outline"
            onClick={async () => {
              setIsRunningCrossCheck(true);
              try {
                const resp = await apiRequest("POST", "/api/cross-similarity/run-all");
                const data = await resp.json();
                toast({ title: "Cross-similarity check started", description: data.message });
                // Refresh flags after a short delay to let the backfill run
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/cross-similarity/flagged"] }), 5000);
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/cross-similarity/flagged"] }), 15000);
              } catch {
                toast({ title: "Failed to start cross-check", variant: "destructive" });
              } finally {
                setIsRunningCrossCheck(false);
              }
            }}
            disabled={isRunningCrossCheck}
          >
            {isRunningCrossCheck ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GitCompare className="mr-2 h-4 w-4" />
            )}
            {isRunningCrossCheck ? "Running..." : "Cross-Check All"}
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
                    {crossSimilarityResults[submission.id]?.maxSimilarityScore > 0 && (
                      <Badge
                        variant={crossSimilarityResults[submission.id].maxSimilarityScore >= 70 ? "destructive" : "secondary"}
                        className="flex items-center gap-1"
                        title="Cross-assignment similarity detected"
                      >
                        <GitCompare className="h-3 w-3" />
                        {crossSimilarityResults[submission.id].maxSimilarityScore}% cross-match
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => checkPlagiarism(submission.id)}
                      disabled={checkingPlagiarism === submission.id}
                      data-testid={`button-plagiarism-check-${submission.id}`}
                    >
                      {checkingPlagiarism === submission.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      ) : (
                        <Shield className="h-4 w-4 mr-2" />
                      )}
                      {plagiarismResults[submission.id] ? "Recheck" : "Check Plagiarism"}
                    </Button>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

                <div className="flex flex-wrap gap-2 mb-4">
                  {submission.fileName && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(submission.id)}
                      data-testid={`button-download-${submission.id}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regradeSubmission(submission.id)}
                    disabled={regrading === submission.id}
                    data-testid={`button-regrade-${submission.id}`}
                  >
                    {regrading === submission.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {submission.isGraded ? "Regrade" : "Grade"}
                  </Button>
                  
                  {submission.isGraded && submission.studentEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendEvaluationEmail(submission.id)}
                      disabled={sendingEmail === submission.id}
                      data-testid={`button-email-evaluation-${submission.id}`}
                    >
                      {sendingEmail === submission.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Email Evaluation
                    </Button>
                  )}
                </div>

                {plagiarismResults[submission.id] && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3" data-testid={`plagiarism-result-${submission.id}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Plagiarism Check Results
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <span className="text-sm font-medium">AI Detection:</span>
                        {plagiarismResults[submission.id].isAiGenerated ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            AI Generated ({plagiarismResults[submission.id].aiConfidence}% confidence)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Human Written ({100 - (plagiarismResults[submission.id].aiConfidence || 0)}% confidence)
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="text-sm font-medium">Similarity Score:</span>
                        <Badge 
                          variant={plagiarismResults[submission.id].overallSimilarityScore > 50 ? "destructive" : 
                                   plagiarismResults[submission.id].overallSimilarityScore > 20 ? "secondary" : "outline"}
                          className={plagiarismResults[submission.id].overallSimilarityScore <= 20 ? "text-green-600 border-green-600" : ""}
                        >
                          {plagiarismResults[submission.id].overallSimilarityScore}%
                        </Badge>
                      </div>
                    </div>

                    {plagiarismResults[submission.id].aiExplanation && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">AI Analysis:</span> {plagiarismResults[submission.id].aiExplanation}
                      </div>
                    )}

                    {plagiarismResults[submission.id].similarSubmissions?.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Similar Submissions Found:
                        </h5>
                        <div className="space-y-2">
                          {plagiarismResults[submission.id].similarSubmissions.map((similar: any, index: number) => (
                            <div 
                              key={index} 
                              className="p-2 bg-background rounded border text-sm"
                              data-testid={`similar-submission-${submission.id}-${index}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">{similar.studentName}</span>
                                  <span className="text-muted-foreground ml-2">(ID: {similar.studentId})</span>
                                </div>
                                <Badge variant={similar.similarityPercentage > 50 ? "destructive" : "secondary"}>
                                  {similar.similarityPercentage}% match
                                </Badge>
                              </div>
                              {similar.matchedPhrases?.length > 0 && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <span className="font-medium">Matched phrases: </span>
                                  {similar.matchedPhrases.slice(0, 2).map((phrase: string, i: number) => (
                                    <span key={i} className="italic">"{phrase.substring(0, 50)}..." </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {crossSimilarityResults[submission.id]?.maxSimilarityScore > 0 && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2 text-orange-800 dark:text-orange-300">
                        <GitCompare className="h-4 w-4" />
                        Cross-Assignment Similarity Detected
                      </h4>
                      <Badge
                        variant={crossSimilarityResults[submission.id].maxSimilarityScore >= 70 ? "destructive" : "secondary"}
                      >
                        Max {crossSimilarityResults[submission.id].maxSimilarityScore}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      This submission shares content with submissions across other assignments. Flagged for review.
                    </p>
                    <div className="space-y-2">
                      {crossSimilarityResults[submission.id].similarSubmissions?.map((similar: any, index: number) => (
                        <div
                          key={index}
                          className="p-3 bg-white dark:bg-background rounded border border-orange-200 dark:border-orange-800 text-sm"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="font-semibold">{similar.studentName}</span>
                              <span className="text-muted-foreground ml-2 text-xs">(ID: {similar.studentId})</span>
                              {similar.studentEmail && (
                                <span className="text-muted-foreground ml-2 text-xs">{similar.studentEmail}</span>
                              )}
                            </div>
                            <Badge variant={similar.similarityPercentage >= 70 ? "destructive" : "secondary"}>
                              {similar.similarityPercentage}% match
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Assignment: </span>
                            {similar.assignmentTitle}
                          </div>
                          {similar.matchedPhrases?.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              <span className="font-medium">Matched: </span>
                              {similar.matchedPhrases.slice(0, 2).map((phrase: string, i: number) => (
                                <span key={i} className="italic">"{phrase.substring(0, 60)}..." </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
