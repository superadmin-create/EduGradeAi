import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, FileText, Users, Calendar, MoreHorizontal, Trash2, Edit, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AssignmentDialog from "@/components/assignments/assignment-dialog";

interface Assignment {
  id: string;
  title: string;
  createdAt: string;
  maxPoints: number;
  caseStudyContent: string;
  description?: string;
  isActive?: boolean;
}

export default function Assignments() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  // Fetch submission counts for all assignments
  const { data: submissionCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/assignments", "submission-counts"],
    queryFn: async () => {
      if (!assignments) return {};
      
      const counts: Record<string, number> = {};
      
      for (const assignment of assignments) {
        const response = await fetch(`/api/assignments/${assignment.id}/submissions`, {
          credentials: "include",
        });
        if (response.ok) {
          const submissions = await response.json();
          counts[assignment.id] = submissions.length;
        } else {
          counts[assignment.id] = 0;
        }
      }
      
      return counts;
    },
    enabled: !!assignments && assignments.length > 0,
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assignments/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
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

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PUT", `/api/assignments/${id}`, { isActive });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.isActive ? "Assignment reactivated" : "Assignment deactivated",
        description: variables.isActive
          ? "The submission link is active again."
          : "The submission link will now tell students the deadline has passed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update assignment status",
        variant: "destructive",
      });
    },
  });

  const handleToggleActive = (assignment: Assignment) => {
    toggleActiveMutation.mutate({ id: assignment.id, isActive: !(assignment.isActive ?? true) });
  };

  const filteredAssignments = assignments?.filter((assignment) =>
    assignment.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleDeleteAssignment = (id: string) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      deleteAssignmentMutation.mutate(id);
    }
  };

  const handleCreateAssignment = () => {
    setDialogMode("create");
    setSelectedAssignment(null);
    setDialogOpen(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setDialogMode("edit");
    setSelectedAssignment(assignment);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-assignments"
            />
          </div>
        </div>
        <Button onClick={handleCreateAssignment} data-testid="button-create-assignment">
          <Plus className="mr-2 h-4 w-4" />
          Create Assignment
        </Button>
      </div>

      {filteredAssignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No assignments found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery ? "Try adjusting your search query" : "Get started by creating your first assignment"}
            </p>
            <Button onClick={handleCreateAssignment} data-testid="button-create-first-assignment">
              <Plus className="mr-2 h-4 w-4" />
              Create Assignment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((assignment) => (
            <Card key={assignment.id} className="hover:shadow-lg transition-shadow" data-testid={`card-assignment-${assignment.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-foreground truncate">
                      {assignment.title}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditAssignment(assignment)} data-testid={`button-edit-assignment-${assignment.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(assignment)}
                        data-testid={`button-toggle-active-assignment-${assignment.id}`}
                      >
                        {(assignment.isActive ?? true) ? (
                          <>
                            <Ban className="mr-2 h-4 w-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Reactivate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteAssignment(assignment.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Case Study
                      </Badge>
                      {!(assignment.isActive ?? true) && (
                        <Badge variant="destructive" className="text-xs" data-testid={`badge-inactive-${assignment.id}`}>
                          Deactivated
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {assignment.maxPoints} Points
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div 
                      className="flex items-center text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => setLocation(`/submissions?assignment=${assignment.id}`)}
                      data-testid={`link-submissions-${assignment.id}`}
                    >
                      <Users className="mr-2 w-4 h-4" />
                      <span>{submissionCounts[assignment.id] || 0} submissions</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 w-4 h-4" />
                      <span>Created {new Date(assignment.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Grading Progress</span>
                      <span>0%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: "0%" }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AssignmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        assignment={selectedAssignment}
        mode={dialogMode}
      />
    </div>
  );
}
