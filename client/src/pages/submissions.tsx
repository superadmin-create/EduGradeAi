import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, FileText, User, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UploadModal from "@/components/submissions/upload-modal";

export default function Submissions() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const assignmentFromQuery = searchParams.get('assignment') || "all";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<string>(assignmentFromQuery);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

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
        
        <Button 
          onClick={() => setLocation('/upload')}
          data-testid="button-upload-submissions-header"
        >
          Upload Submissions
        </Button>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLocation(`/grading-results?submissionId=${submission.id}`)}
                    data-testid={`button-view-submission-${submission.id}`}
                  >
                    View Details
                  </Button>
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
