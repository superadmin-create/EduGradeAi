import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  caseStudyContent: z.string().min(1, "Case study content is required"),
  maxPoints: z.number().min(1).max(1000),
});

type AssignmentForm = z.infer<typeof assignmentSchema>;

export default function AssignmentUpload() {
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

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: AssignmentForm) => {
      const response = await apiRequest("POST", "/api/assignments", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Assignment created successfully",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create assignment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AssignmentForm) => {
    createAssignmentMutation.mutate(data);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Create Case Study Assignment</h3>
      
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
                    data-testid="input-assignment-title"
                  />
                </FormControl>
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
                    className="min-h-[120px]"
                    {...field}
                    data-testid="textarea-case-study"
                  />
                </FormControl>
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
                    data-testid="input-max-points"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full"
            disabled={createAssignmentMutation.isPending}
            data-testid="button-create-assignment"
          >
            {createAssignmentMutation.isPending ? "Creating..." : "Create Assignment"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
