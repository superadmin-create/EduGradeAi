import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import FileDropzone from "@/components/ui/file-dropzone";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export default function BatchUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [autoGrade, setAutoGrade] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, currentFile: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  interface Assignment {
    id: string;
    title: string;
  }

  const batchUploadMutation = useMutation({
    mutationFn: async (data: { files: File[]; assignmentId: string; autoGrade: boolean }) => {
      const totalFiles = data.files.length;
      let successCount = 0;
      const errors: { fileName: string; error: string }[] = [];

      for (let i = 0; i < totalFiles; i++) {
        const file = data.files[i];
        setUploadProgress({ current: i + 1, total: totalFiles, currentFile: file.name });

        const formData = new FormData();
        formData.append("files", file);

        const maxRetries = 3;
        let uploaded = false;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const response = await fetch(`/api/assignments/${data.assignmentId}/submissions/batch`, {
              method: "POST",
              body: formData,
              credentials: "include",
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText);
            }

            const result = await response.json();
            if (result.success > 0) {
              successCount += result.success;
            }
            if (result.errors && result.errors.length > 0) {
              errors.push(...result.errors);
            }
            uploaded = true;
            break;
          } catch (error) {
            if (attempt < maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            errors.push({
              fileName: file.name,
              error: error instanceof Error ? error.message : "Upload failed"
            });
          }
        }
      }

      if (data.autoGrade && successCount > 0) {
        try {
          await apiRequest("POST", `/api/assignments/${data.assignmentId}/grade-all`);
        } catch (e) {
        }
      }

      return { success: successCount, errorCount: errors.length, errors };
    },
    onSuccess: (result) => {
      setUploadProgress({ current: 0, total: 0, currentFile: "" });
      const errorMsg = result.errorCount > 0 
        ? ` ${result.errorCount} failed: ${result.errors.map((e: any) => e.fileName).join(", ")}`
        : "";
      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${result.success} submissions.${errorMsg}`,
        variant: result.errorCount > 0 ? "destructive" : "default",
      });
      setSelectedFiles([]);
      setSelectedAssignment("");
      setAutoGrade(false);
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      setUploadProgress({ current: 0, total: 0, currentFile: "" });
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAssignment) {
      toast({
        title: "Error",
        description: "Please select an assignment",
        variant: "destructive",
      });
      return;
    }

    batchUploadMutation.mutate({
      files: selectedFiles,
      assignmentId: selectedAssignment,
      autoGrade,
    });
  };

  const progressPercent = uploadProgress.total > 0 
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100) 
    : 0;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Batch Submission Upload</h3>
      
      <FileDropzone
        onFilesSelected={handleFilesSelected}
        acceptedTypes={{}}
        maxSize={10 * 1024 * 1024}
        multiple={true}
        icon={<FileUp className="text-3xl text-muted-foreground mb-3" />}
        title="Upload Student Submissions"
        description="Supports PDF, DOCX, XLSX, XLS, CSV, TXT, MD files - Drop multiple files or select folder"
      />
      
      {selectedFiles.length > 0 && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium text-foreground mb-2">
            Selected Files ({selectedFiles.length}):
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {selectedFiles.map((file, index) => (
              <p key={index} className="text-sm text-muted-foreground">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            ))}
          </div>
        </div>
      )}

      {batchUploadMutation.isPending && uploadProgress.total > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Uploading {uploadProgress.current} of {uploadProgress.total}...</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground truncate">
            Current: {uploadProgress.currentFile}
          </p>
        </div>
      )}
      
      <div className="mt-4 space-y-4">
        <div>
          <Label className="text-sm font-medium text-foreground mb-2 block">Assignment</Label>
          <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
            <SelectTrigger data-testid="select-batch-assignment">
              <SelectValue placeholder="Select assignment..." />
            </SelectTrigger>
            <SelectContent>
              {assignments?.map((assignment) => (
                <SelectItem key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="auto-grade" 
            checked={autoGrade}
            onCheckedChange={(checked) => setAutoGrade(checked === true)}
            data-testid="checkbox-auto-grade"
          />
          <Label htmlFor="auto-grade" className="text-sm text-foreground">
            Start AI grading immediately
          </Label>
        </div>

        <Button 
          onClick={handleUpload}
          disabled={batchUploadMutation.isPending}
          className="w-full"
          data-testid="button-batch-upload"
        >
          {batchUploadMutation.isPending 
            ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...` 
            : "Upload Submissions"}
        </Button>
      </div>
    </div>
  );
}
