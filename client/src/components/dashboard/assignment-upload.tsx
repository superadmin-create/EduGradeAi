import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import FileDropzone from "@/components/ui/file-dropzone";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  course: z.string().min(1, "Course is required"),
  description: z.string().optional(),
});

type AssignmentForm = z.infer<typeof assignmentSchema>;

interface Question {
  id: string;
  question: string;
  expectedAnswer: string;
  points: number;
}

interface AssignmentUploadProps {
  questions: Question[];
}

export default function AssignmentUpload({ questions }: AssignmentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AssignmentForm>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      course: "",
      description: "",
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: AssignmentForm & { questions: any[] }) => {
      const response = await apiRequest("POST", "/api/assignments", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Assignment created successfully",
      });
      form.reset();
      setUploadedFiles([]);
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

  const handleFilesSelected = (files: File[]) => {
    setUploadedFiles(files);
  };

  const onSubmit = (data: AssignmentForm) => {
    // In development mode, allow assignment creation without files for testing
    const isDevelopment = import.meta.env.DEV;
    
    if (!isDevelopment && uploadedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please upload at least one assignment file",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one question in the Answer Key section",
        variant: "destructive",
      });
      return;
    }

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    createAssignmentMutation.mutate({
      ...data,
      questions,
      totalPoints,
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Upload New Assignment</h3>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            acceptedTypes={{
              "application/pdf": [".pdf"],
              "application/msword": [".doc"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
              "text/plain": [".txt"],
            }}
            maxSize={10 * 1024 * 1024}
            multiple={false}
          />

          {uploadedFiles.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium text-foreground">Uploaded Files:</p>
              {uploadedFiles.map((file, index) => (
                <p key={index} className="text-sm text-muted-foreground">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              ))}
            </div>
          )}

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
            name="course"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Course</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-course">
                      <SelectValue placeholder="Select course..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cs101">Computer Science 101</SelectItem>
                    <SelectItem value="advanced-programming">Advanced Programming</SelectItem>
                    <SelectItem value="data-structures">Data Structures</SelectItem>
                  </SelectContent>
                </Select>
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
