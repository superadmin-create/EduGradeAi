import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import Dashboard from "@/pages/dashboard";
import Assignments from "@/pages/assignments";
import Submissions from "@/pages/submissions";
import UploadPage from "@/pages/upload";
import GradingResults from "@/pages/grading-results";
import Login from "@/pages/login";
import StudentPortal from "@/pages/student-portal";
import NotFound from "@/pages/not-found";

function AuthenticatedRouter() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/assignments" component={Assignments} />
            <Route path="/submissions" component={Submissions} />
            <Route path="/upload" component={UploadPage} />
            <Route path="/grading-results" component={GradingResults} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/session"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading) {
      setIsAuthenticated(!!session?.user);
    }
  }, [session, isLoading]);

  const handleLoginSuccess = () => {
    refetch();
  };

  const handleLogout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    setIsAuthenticated(false);
    queryClient.clear();
  };

  if (isLoading || isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/student/:collegeCode" component={StudentPortal} />
          <Route>
            <AppContent />
          </Route>
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
