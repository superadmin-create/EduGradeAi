import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, TrendingUp, FileText, User, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function GradingResults() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const submissionId = searchParams.get('submissionId');

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

  interface GradingResult {
    id: string;
    submissionId: string;
    aiAnalysis: {
      grade: string;
      score: number;
      maxScore: number;
      percentage: number;
      feedback: string;
      improvements: string[];
      reasoning: string;
    };
    finalScore: number;
    maxScore: number;
    percentage: number;
    feedback: string;
    createdAt: string;
  }

  const { data: submission, isLoading: submissionLoading } = useQuery<Submission>({
    queryKey: [`/api/submissions/${submissionId}`],
    enabled: !!submissionId,
  });

  const { data: gradingResult, isLoading: gradingLoading } = useQuery<GradingResult>({
    queryKey: [`/api/submissions/${submissionId}/result`],
    enabled: !!submissionId,
  });

  if (!submissionId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No submission selected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Please select a submission from the submissions page to view grading results.
            </p>
            <Button onClick={() => setLocation('/submissions')} data-testid="button-go-to-submissions">
              View Submissions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submissionLoading || gradingLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4">Loading grading results...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!submission || !gradingResult) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No grading results found</h3>
            <p className="text-muted-foreground text-center mb-4">
              This submission hasn't been graded yet or the results are not available.
            </p>
            <Button onClick={() => setLocation('/submissions')} data-testid="button-back-to-submissions">
              Back to Submissions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysis = gradingResult.aiAnalysis;
  const getGradeColor = (grade: string) => {
    const letter = grade.charAt(0);
    if (letter === 'A') return 'text-accent';
    if (letter === 'B') return 'text-blue-500';
    if (letter === 'C') return 'text-yellow-500';
    if (letter === 'D') return 'text-orange-500';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => setLocation('/submissions')}
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Submissions
      </Button>

      {/* Student Info Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{submission.studentName}</CardTitle>
              <CardDescription className="mt-2 space-y-1">
                <div className="flex items-center text-sm">
                  <User className="mr-2 h-4 w-4" />
                  Student ID: {submission.studentId}
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  Submitted: {new Date(submission.submittedAt).toLocaleString()}
                </div>
              </CardDescription>
            </div>
            <Badge className="bg-accent/10 text-accent border-accent/20 text-lg px-4 py-2">
              <CheckCircle className="mr-2 h-5 w-5" />
              Graded
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Grade Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Final Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${getGradeColor(analysis.grade)}`}>
              {analysis.grade}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {analysis.score}/{analysis.maxScore}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-foreground">
                {analysis.percentage}%
              </div>
              <Progress value={analysis.percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-accent" />
            Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed">{analysis.feedback}</p>
        </CardContent>
      </Card>

      {/* AI Reasoning */}
      {analysis.reasoning && (
        <Card>
          <CardHeader>
            <CardTitle>Grading Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{analysis.reasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Improvements */}
      {analysis.improvements && analysis.improvements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Areas for Improvement</CardTitle>
            <CardDescription>Suggestions to enhance future submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {analysis.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-foreground flex-1">{improvement}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Student's Submission */}
      <Card>
        <CardHeader>
          <CardTitle>Student's Submission</CardTitle>
          <CardDescription>
            {submission.fileName || 'Text submission'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {submission.content}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
