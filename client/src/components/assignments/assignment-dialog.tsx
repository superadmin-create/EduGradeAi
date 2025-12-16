import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  caseStudyContent: z.string().min(1, "Case study content is required"),
  maxPoints: z.number().min(1).max(1000),
});

type AssignmentForm = z.infer<typeof assignmentSchema>;

interface Assignment {
  id: string;
  title: string;
  description?: string;
  caseStudyContent: string;
  maxPoints: number;
}

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: Assignment | null;
  mode: "create" | "edit";
}

export default function AssignmentDialog({ open, onOpenChange, assignment, mode }: AssignmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AssignmentForm>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      caseStudyContent: "",
      maxPoints: 100,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === "edit" && assignment) {
        form.reset({
          title: assignment.title,
          description: assignment.description || "",
          caseStudyContent: assignment.caseStudyContent,
          maxPoints: assignment.maxPoints,
        });
      } else {
        form.reset({
          title: "",
          description: "",
          caseStudyContent: "",
          maxPoints: 100,
        });
      }
    }
  }, [open, mode, assignment, form]);

  const createMutation = useMutation({
    mutationFn: async (data: AssignmentForm) => {
      const response = await apiRequest("POST", "/api/assignments", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Assignment created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create assignment",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AssignmentForm) => {
      const response = await apiRequest("PUT", `/api/assignments/${assignment?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Assignment updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AssignmentForm) => {
    if (mode === "create") {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {mode === "create" ? "Create New Assignment" : "Edit Assignment"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Fill in the details to create a new case study assignment." 
              : "Update the assignment details below."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignment Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter assignment title..." 
                      {...field}
                      data-testid="input-dialog-assignment-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Brief description of the assignment..." 
                      {...field}
                      data-testid="input-dialog-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caseStudyContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Case Study Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter the case study scenario, background, and any questions students should address..." 
                      className="min-h-[150px]"
                      {...field}
                      data-testid="textarea-dialog-case-study"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxPoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Points</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="1000"
                      placeholder="100" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                      data-testid="input-dialog-max-points"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-dialog-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-dialog-submit"
              >
                {isPending 
                  ? (mode === "create" ? "Creating..." : "Updating...") 
                  : (mode === "create" ? "Create Assignment" : "Update Assignment")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
