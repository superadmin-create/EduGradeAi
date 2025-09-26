import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import FileDropzone from "@/components/ui/file-dropzone";

interface Assignment {
  id: string;
  title: string;
  course: string;
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [textContent, setTextContent] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { 
      assignmentId: string;
      studentName: string;
      studentId: string;
      file?: File;
      content?: string;
    }) => {
      const formData = new FormData();
      formData.append("studentName", data.studentName);
      formData.append("studentId", data.studentId);
      
      if (data.file) {
        formData.append("file", data.file);
      } else if (data.content) {
        formData.append("content", data.content);
      }
      
      const response = await fetch(`/api/assignments/${data.assignmentId}/submissions`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload Complete",
        description: "Submission uploaded successfully",
      });
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedFiles([]);
    setSelectedAssignment("");
    setStudentName("");
    setStudentId("");
    setTextContent("");
    setUploadMode("file");
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    if (files.length > 0) {
      setUploadMode("file");
    }
  };

  const handleUpload = () => {
    if (!selectedAssignment) {
      toast({
        title: "Error",
        description: "Please select an assignment",
        variant: "destructive",
      });
      return;
    }

    if (!studentName || !studentId) {
      toast({
        title: "Error",
        description: "Please enter student name and ID",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === "file" && selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === "text" && !textContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter submission content",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      assignmentId: selectedAssignment,
      studentName,
      studentId,
      file: uploadMode === "file" ? selectedFiles[0] : undefined,
      content: uploadMode === "text" ? textContent : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Student Submission</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Assignment Selection */}
          <div className="space-y-2">
            <Label htmlFor="assignment">Assignment</Label>
            <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
              <SelectTrigger data-testid="select-assignment">
                <SelectValue placeholder="Select an assignment" />
              </SelectTrigger>
              <SelectContent>
                {assignments?.map((assignment) => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.title} - {assignment.course}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">Student Name</Label>
              <Input
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter student name"
                data-testid="input-student-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter student ID"
                data-testid="input-student-id"
              />
            </div>
          </div>

          {/* Upload Mode Selection */}
          <div className="space-y-2">
            <Label>Submission Type</Label>
            <div className="flex space-x-4">
              <Button
                variant={uploadMode === "file" ? "default" : "outline"}
                onClick={() => setUploadMode("file")}
                size="sm"
                data-testid="button-upload-file"
              >
                Upload File
              </Button>
              <Button
                variant={uploadMode === "text" ? "default" : "outline"}
                onClick={() => setUploadMode("text")}
                size="sm"
                data-testid="button-upload-text"
              >
                Enter Text
              </Button>
            </div>
          </div>

          {/* File Upload or Text Input */}
          {uploadMode === "file" ? (
            <div className="space-y-2">
              <Label>Submission File</Label>
              <FileDropzone
                onFilesSelected={handleFilesSelected}
                multiple={false}
                title="Drop submission file here"
                description="Supports PDF, DOC, DOCX, TXT files up to 10MB"
              />
              {selectedFiles.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>Selected: {selectedFiles[0].name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFiles([])}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="textContent">Submission Content</Label>
              <Textarea
                id="textContent"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Enter the student's submission text here..."
                rows={8}
                data-testid="textarea-submission-content"
              />
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              data-testid="button-submit-upload"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Submission"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}