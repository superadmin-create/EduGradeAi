import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, User, FileText, Calendar, CheckCircle, Clock, Mail, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Submission {
  id: string;
  assignmentId: string;
  studentName: string;
  studentId: string;
  studentEmail?: string;
  content: string;
  fileName?: string;
  submittedAt: string;
  isGraded: boolean;
  assignmentTitle?: string;
}

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allSubmissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/submissions/all"],
    refetchInterval: 30000,
  });

  const query = searchQuery.trim().toLowerCase();

  const results: Submission[] = query.length < 2
    ? []
    : allSubmissions.filter((sub) => {
        return (
          sub.studentName.toLowerCase().includes(query) ||
          sub.studentId.toLowerCase().includes(query) ||
          (sub.studentEmail && sub.studentEmail.toLowerCase().includes(query)) ||
          (sub.assignmentTitle && sub.assignmentTitle.toLowerCase().includes(query))
        );
      });

  const getStatusIcon = (isGraded: boolean) =>
    isGraded
      ? <CheckCircle className="h-4 w-4 text-accent" />
      : <Clock className="h-4 w-4 text-muted-foreground" />;

  const getStatusBadge = (isGraded: boolean) =>
    isGraded
      ? <Badge className="bg-accent/10 text-accent">Graded</Badge>
      : <Badge variant="outline">Pending</Badge>;

  const uniqueStudents = query.length >= 2
    ? [...new Map(results.map((s) => [s.studentId, s])).values()]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Search Students</h1>
        <p className="text-muted-foreground mt-1">
          Find students by name, roll number, or email address
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Search by name, roll number, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
              data-testid="input-global-search"
            />
          </div>
          {query.length > 0 && query.length < 2 && (
            <p className="text-sm text-muted-foreground mt-2">Type at least 2 characters to search</p>
          )}
        </CardContent>
      </Card>

      {query.length >= 2 && (
        <>
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No results found</h3>
                <p className="text-muted-foreground text-center">
                  No students match "{searchQuery}". Try a different name, roll number, or email.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-semibold text-foreground">{results.length}</span> submission{results.length !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold text-foreground">{uniqueStudents.length}</span> student{uniqueStudents.length !== 1 ? "s" : ""}
              </p>

              {results.map((submission) => (
                <Card
                  key={submission.id}
                  className="hover:shadow-md transition-shadow"
                  data-testid={`search-result-${submission.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(submission.isGraded)}
                        <CardTitle className="text-lg font-semibold text-foreground">
                          {submission.studentName}
                        </CardTitle>
                        {getStatusBadge(submission.isGraded)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setLocation(`/grading-results?submissionId=${submission.id}`)
                        }
                        data-testid={`button-view-result-${submission.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Hash className="mr-2 w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Roll No: {submission.studentId}</span>
                      </div>

                      {submission.studentEmail && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Mail className="mr-2 w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{submission.studentEmail}</span>
                        </div>
                      )}

                      <div className="flex items-center text-sm text-muted-foreground">
                        <FileText className="mr-2 w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{submission.assignmentTitle || "Unknown Assignment"}</span>
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="mr-2 w-4 h-4 flex-shrink-0" />
                        <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-7 px-2"
                        onClick={() =>
                          setLocation(`/submissions?assignment=${submission.assignmentId}`)
                        }
                        data-testid={`button-view-assignment-submissions-${submission.id}`}
                      >
                        <User className="h-3 w-3 mr-1" />
                        See all submissions for this assignment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {query.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Search across all submissions</h3>
            <p className="text-muted-foreground max-w-md">
              Enter a student's name, roll number, or email address above to find their submissions and grading results across all assignments.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <Badge variant="outline" className="flex items-center gap-1.5">
                <User className="h-3 w-3" /> Student Name
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Hash className="h-3 w-3" /> Roll Number
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email Address
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
