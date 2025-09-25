import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BarChart3, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export default function GradingResults() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");

  interface Assignment {
    id: string;
    title: string;
    course: string;
  }

  interface StatsData {
    totalAssignments: number;
    pendingGrading: number;
    totalStudents: number;
    averageGrade: number;
  }

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: stats } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  // For demo purposes, we'll show empty state
  // In real implementation, you'd fetch grading results
  const gradingResults: any[] = [];

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-accent" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const overviewStats = [
    {
      title: "Total Graded",
      value: "0",
      change: 0,
      description: "assignments graded"
    },
    {
      title: "Average Score",
      value: `${stats?.averageGrade || 0}%`,
      change: 3.2,
      description: "across all assignments"
    },
    {
      title: "Completion Rate",
      value: "0%",
      change: 0,
      description: "submission rate"
    },
    {
      title: "AI Accuracy",
      value: "95%",
      change: 2.1,
      description: "grading confidence"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewStats.map((stat, index) => (
          <Card key={index} data-testid={`stat-card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(stat.change)}
                  <span className={`text-xs ${
                    stat.change > 0 ? 'text-accent' : 
                    stat.change < 0 ? 'text-destructive' : 
                    'text-muted-foreground'
                  }`}>
                    {stat.change > 0 ? '+' : ''}{stat.change}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-results"
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

        <Button variant="outline" data-testid="button-export-results">
          <Download className="mr-2 h-4 w-4" />
          Export Results
        </Button>
      </div>

      {/* Results Content */}
      {gradingResults.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No grading results available</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start grading assignments to see detailed analytics and results here.
            </p>
            <div className="flex space-x-2">
              <Button variant="outline" data-testid="button-upload-for-grading">
                Upload Assignments
              </Button>
              <Button data-testid="button-start-grading">
                Start Grading
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['A (90-100%)', 'B (80-89%)', 'C (70-79%)', 'D (60-69%)', 'F (0-59%)'].map((grade, index) => (
                  <div key={grade} className="flex items-center space-x-4">
                    <div className="w-20 text-sm font-medium text-foreground">{grade}</div>
                    <div className="flex-1">
                      <Progress value={Math.random() * 100} className="h-2" />
                    </div>
                    <div className="w-12 text-sm text-muted-foreground text-right">
                      {Math.floor(Math.random() * 50)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Individual Results */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gradingResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium text-foreground">{result.studentName}</p>
                        <p className="text-sm text-muted-foreground">{result.assignmentTitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium text-foreground">{result.percentage}%</p>
                        <p className="text-sm text-muted-foreground">{result.finalScore}/{result.maxScore}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
