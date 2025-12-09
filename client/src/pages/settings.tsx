import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link, ExternalLink, GraduationCap, Settings as SettingsIcon } from "lucide-react";
import type { Assignment, College } from "@shared/schema";

interface SessionData {
  user: { id: string; username: string };
  college: College;
}

export default function Settings() {
  const { toast } = useToast();

  const { data: session } = useQuery<SessionData>({
    queryKey: ["/api/auth/session"],
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const collegeCode = session?.college?.code || "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Generate URL-friendly slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} has been copied to clipboard.`,
    });
  };

  const getPortalLink = (title: string) => {
    const slug = generateSlug(title);
    return `${baseUrl}/student/${collegeCode}/${slug}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your portal links and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Student Portal Links
          </CardTitle>
          <CardDescription>
            Share these links with students to allow them to submit assignments directly.
            Each assignment has its own unique submission portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No assignments created yet.</p>
              <p className="text-sm mt-1">Create an assignment to generate student portal links.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const portalLink = getPortalLink(assignment.title);
                return (
                  <div
                    key={assignment.id}
                    className="border rounded-lg p-4 space-y-3"
                    data-testid={`portal-link-${assignment.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {assignment.maxPoints} points
                          {assignment.dueDate && ` • Due: ${new Date(assignment.dueDate).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(portalLink, "Portal link")}
                          data-testid={`button-copy-${assignment.id}`}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={portalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`button-open-${assignment.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={portalLink}
                        readOnly
                        className="font-mono text-sm bg-muted"
                        data-testid={`input-link-${assignment.id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            College Information
          </CardTitle>
          <CardDescription>
            Your college details and portal configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">College Name</label>
              <p className="text-foreground font-medium" data-testid="text-college-name">
                {session?.college?.name || "Loading..."}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">College Code</label>
              <p className="text-foreground font-medium font-mono" data-testid="text-college-code">
                {collegeCode || "Loading..."}
              </p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">General Student Portal</label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={`${baseUrl}/student/${collegeCode}`}
                readOnly
                className="font-mono text-sm bg-muted"
                data-testid="input-general-portal"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/student/${collegeCode}`, "General portal link")}
                data-testid="button-copy-general"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Students can use this link to view all available assignments.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
