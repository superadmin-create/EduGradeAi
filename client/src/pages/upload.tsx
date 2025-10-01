import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import FileDropzone from "@/components/ui/file-dropzone";
import { useLocation } from "wouter";

interface Assignment {
  id: string;
  title: string;
}

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [textContent, setTextContent] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

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
        description: "Submission uploaded successfully and AI grading started",
      });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", "submission-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setLocation("/submissions");
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
    setSelectedFile(null);
    setSelectedAssignment("");
    setStudentName("");
    setStudentId("");
    setTextContent("");
    setUploadMode("file");
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 1) {
      toast({
        title: "Multiple Files Not Supported",
        description: "Please select only one file at a time",
        variant: "destructive",
      });
      return;
    }
    
    if (files.length === 1) {
      setSelectedFile(files[0]);
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

    if (uploadMode === "file" && !selectedFile) {
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
      file: uploadMode === "file" ? selectedFile : undefined,
      content: uploadMode === "text" ? textContent : undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Student Submission</h1>
        <p className="text-muted-foreground mt-2">Submit student work for AI grading</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
          <CardDescription>Enter student information and upload their assignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assignment Selection */}
          <div className="space-y-2">
            <Label htmlFor="assignment">Assignment *</Label>
            <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
              <SelectTrigger data-testid="select-assignment-upload">
                <SelectValue placeholder="Select an assignment" />
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

          {/* Student Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">Student Name *</Label>
              <Input
                id="studentName"
                placeholder="Enter student name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                data-testid="input-student-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID *</Label>
              <Input
                id="studentId"
                placeholder="Enter student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                data-testid="input-student-id"
              />
            </div>
          </div>

          {/* Upload Mode Toggle */}
          <div className="space-y-2">
            <Label>Submission Type *</Label>
            <div className="flex space-x-4">
              <Button
                type="button"
                variant={uploadMode === "file" ? "default" : "outline"}
                onClick={() => setUploadMode("file")}
                className="flex-1"
                data-testid="button-upload-file-mode"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Button
                type="button"
                variant={uploadMode === "text" ? "default" : "outline"}
                onClick={() => setUploadMode("text")}
                className="flex-1"
                data-testid="button-enter-text-mode"
              >
                <FileText className="mr-2 h-4 w-4" />
                Enter Text
              </Button>
            </div>
          </div>

          {/* File Upload or Text Entry */}
          {uploadMode === "file" ? (
            <div className="space-y-2">
              <Label>Upload File *</Label>
              <FileDropzone
                onFilesSelected={handleFilesSelected}
                acceptedTypes={{
                  'application/pdf': ['.pdf'],
                  'application/msword': ['.doc'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'text/plain': ['.txt']
                }}
                multiple={false}
              />
              {selectedFiles.length > 0 && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="text-sm text-foreground">Selected: {selectedFiles[0].name}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="textContent">Submission Content *</Label>
              <Textarea
                id="textContent"
                placeholder="Paste or type the student's submission here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={10}
                data-testid="textarea-submission-content"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/submissions")}
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
        </CardContent>
      </Card>
    </div>
  );
}
