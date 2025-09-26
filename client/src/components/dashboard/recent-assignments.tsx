import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Book, Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Assignment {
  id: string;
  title: string;
  course: string;
  createdAt: string;
  maxPoints: number;
  caseStudyContent: string;
  description?: string;
}

export default function RecentAssignments() {
  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
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
              className="assignment-card p-4 rounded-lg cursor-pointer"
              data-testid={`card-assignment-${assignment.id}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground truncate">{assignment.title}</h4>
                {getStatusBadge(assignment)}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Book className="mr-2 w-4 h-4" />
                  <span>{assignment.course}</span>
                </div>
                
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 w-4 h-4" />
                  <span>0 submissions</span>
                </div>
                
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 w-4 h-4" />
                  <span>{new Date(assignment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Grading Progress</span>
                  <span>0%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="progress-bar h-2 rounded-full" style={{ width: "0%" }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
