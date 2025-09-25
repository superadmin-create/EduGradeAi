import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, User, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Submissions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");

  interface Assignment {
    id: string;
    title: string;
    course: string;
  }

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  // For demo purposes, we'll show empty state
  // In real implementation, you'd fetch submissions based on selected assignment
  const submissions: any[] = [];

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
      </div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No submissions found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Students haven't submitted any work yet, or you haven't created any assignments.
            </p>
            <div className="flex space-x-2">
              <Button variant="outline" data-testid="button-upload-submissions">
                Upload Submissions
              </Button>
              <Button data-testid="button-create-assignment-from-submissions">
                Create Assignment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
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
                  <Button variant="outline" size="sm" data-testid={`button-view-submission-${submission.id}`}>
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
                
                {submission.isGraded && (
                  <div className="mt-4 p-3 bg-accent/5 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Score</span>
                      <span className="text-lg font-bold text-accent">
                        {submission.score}/{submission.maxScore} ({submission.percentage}%)
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
