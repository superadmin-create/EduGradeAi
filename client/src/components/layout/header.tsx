import { useLocation } from "wouter";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  "/grading-results": {
    title: "Grading Results",
    subtitle: "Review AI grading results and analytics"
  }
};

export default function Header() {
  const [location] = useLocation();
  const config = pageConfig[location as keyof typeof pageConfig] || pageConfig["/"];

  return (
    <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{config.title}</h2>
          <p className="text-muted-foreground">{config.subtitle}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full"></span>
          </Button>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">Shaswat Srivastava</p>
              <p className="text-xs text-muted-foreground">Professor</p>
            </div>
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
              SS
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
