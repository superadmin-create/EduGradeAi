import { useLocation } from "wouter";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const pageConfig = {
  "/": {
    title: "Dashboard",
    subtitle: "Manage assignments and view grading results"
  },
  "/assignments": {
    title: "Assignments",
    subtitle: "Create and manage your assignments"
  },
  "/submissions": {
    title: "Student Submissions",
    subtitle: "View and manage student submissions"
  },
  "/upload": {
    title: "Upload Submissions",
    subtitle: "Upload student submissions for grading"
  },
  "/grading-results": {
    title: "Grading Results",
    subtitle: "Review AI grading results and analytics"
  },
  "/search": {
    title: "Search Students",
    subtitle: "Find students by name, roll number, or email"
  }
};

interface SessionData {
  user: { id: string; name: string; role: string } | null;
  college: { id: string; name: string; code: string; quota: number; usedQuota: number } | null;
}

interface HeaderProps {
  onLogout?: () => void;
}

export default function Header({ onLogout }: HeaderProps) {
  const [location] = useLocation();
  const { toast } = useToast();
  const config = pageConfig[location as keyof typeof pageConfig] || pageConfig["/"];

  const { data: session } = useQuery<SessionData>({
    queryKey: ["/api/auth/session"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    },
  });

  const user = session?.user;
  const college = session?.college;
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{config.title}</h2>
          <p className="text-muted-foreground">{config.subtitle}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {college && (
            <div className="hidden md:flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">Quota:</span>
              <span className="text-sm font-medium">
                {college.usedQuota}/{college.quota}
              </span>
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    college.usedQuota / college.quota > 0.9 
                      ? 'bg-destructive' 
                      : college.usedQuota / college.quota > 0.7 
                        ? 'bg-amber-500' 
                        : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (college.usedQuota / college.quota) * 100)}%` }}
                />
              </div>
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground" data-testid="text-username">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground" data-testid="text-college">
                {college?.name || ""}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
              {initials}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
