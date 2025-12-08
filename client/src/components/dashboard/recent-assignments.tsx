import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Calendar, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

interface Assignment {
  id: string;
  title: string;
  createdAt: string;
  maxPoints: number;
  caseStudyContent: string;
  description?: string;
}

export default function RecentAssignments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  // Fetch submission counts and grading progress for each assignment
  const { data: assignmentStats = {} } = useQuery<Record<string, { submissions: number; graded: number }>>({
    queryKey: ["/api/assignments", "dashboard-stats"],
    queryFn: async () => {
      if (!assignments) return {};
      
      const stats: Record<string, { submissions: number; graded: number }> = {};
      
      for (const assignment of assignments) {
        try {
          const response = await fetch(`/api/assignments/${assignment.id}/submissions`, {
            credentials: "include",
          });
          if (response.ok) {
            const submissions = await response.json();
            const gradedCount = submissions.filter((s: any) => s.isGraded).length;
            stats[assignment.id] = { 
              submissions: submissions.length, 
              graded: gradedCount 
            };
          } else {
            stats[assignment.id] = { submissions: 0, graded: 0 };
          }
        } catch {
          stats[assignment.id] = { submissions: 0, graded: 0 };
        }
      }
      
      return stats;
    },
    enabled: !!assignments && assignments.length > 0,
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assignments/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Deleted",
        description: "Assignment deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Recent Assignments</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="assignment-card p-4 rounded-lg animate-pulse">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-muted rounded w-32"></div>
                  <div className="h-5 bg-muted rounded w-16"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-40"></div>
                  <div className="h-4 bg-muted rounded w-36"></div>
                  <div className="h-4 bg-muted rounded w-32"></div>
                </div>
                <div className="h-2 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const recentAssignments = assignments?.slice(0, 6) || [];

  const getStatusBadge = (assignment: Assignment) => {
    // Simple status logic - in real app this would be more sophisticated
    const daysSinceCreated = Math.floor((Date.now() - new Date(assignment.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCreated < 7) {
      return <Badge className="bg-accent/10 text-accent">Active</Badge>;
    } else if (daysSinceCreated < 14) {
      return <Badge className="bg-primary/10 text-primary">Completed</Badge>;
    } else {
      return <Badge variant="destructive">Overdue</Badge>;
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Recent Assignments</h3>
        <Link href="/assignments">
          <Button variant="ghost" size="sm" data-testid="button-view-all-assignments">
            View All <ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </Link>
      </div>
      
      {recentAssignments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No assignments created yet.</p>
          <Link href="/assignments">
            <Button className="mt-4" data-testid="button-create-first-assignment">
              Create Your First Assignment
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentAssignments.map((assignment) => (
            <div 
              key={assignment.id} 
              className="assignment-card p-4 rounded-lg"
              data-testid={`card-assignment-${assignment.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground truncate flex-1">{assignment.title}</h4>
                <div className="flex items-center gap-2">
                  {getStatusBadge(assignment)}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        data-testid={`button-delete-assignment-${assignment.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{assignment.title}"? This will also delete all submissions and grades for this assignment. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 w-4 h-4" />
                  <span data-testid={`text-submissions-${assignment.id}`}>
                    {assignmentStats[assignment.id]?.submissions || 0} submissions
                  </span>
                </div>
                
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 w-4 h-4" />
                  <span>{new Date(assignment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="mt-4">
                {(() => {
                  const stats = assignmentStats[assignment.id];
                  const progress = stats && stats.submissions > 0 
                    ? Math.round((stats.graded / stats.submissions) * 100) 
                    : 0;
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Grading Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="progress-bar h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
