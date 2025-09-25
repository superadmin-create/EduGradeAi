import { useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatsData {
  totalAssignments: number;
  pendingGrading: number;
  totalStudents: number;
  averageGrade: number;
}

export default function GradingStatus() {
  const { data: stats } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">AI Grading Status</h3>
      
      <div className="space-y-4">
        {(stats?.pendingGrading || 0) > 0 ? (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Bot className="text-primary-foreground text-sm" />
              </div>
              <div>
                <p className="font-medium text-foreground">Processing Submissions</p>
                <p className="text-sm text-muted-foreground">Multiple assignments pending</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{stats?.pendingGrading || 0}</p>
              <p className="text-xs text-muted-foreground">pending</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <CheckCircle className="text-accent-foreground text-sm" />
              </div>
              <div>
                <p className="font-medium text-foreground">All Caught Up</p>
                <p className="text-sm text-muted-foreground">No pending grading tasks</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">0</p>
              <p className="text-xs text-accent">Ready for review</p>
            </div>
          </div>
        )}
      </div>
      
      <Button 
        className="w-full mt-4" 
        variant="outline"
        data-testid="button-view-grading-queue"
      >
        View Grading Queue
      </Button>
    </div>
  );
}
