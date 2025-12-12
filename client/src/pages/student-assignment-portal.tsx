import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle, GraduationCap, BookOpen, Calendar, Award } from "lucide-react";

interface PublicAssignment {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  maxPoints: number;
  dueDate: string | null;
}

interface CollegeInfo {
  id: string;
  name: string;
  code: string;
}

export default function StudentAssignmentPortal() {
  const params = useParams();
  const collegeCode = params.collegeCode as string;
  const assignmentSlug = params.assignmentSlug as string;
  const { toast } = useToast();
  
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: college, isLoading: collegeLoading, error: collegeError } = useQuery<CollegeInfo>({
    queryKey: ["/api/public", collegeCode],
    queryFn: async () => {
      const res = await fetch(`/api/public/${collegeCode}`);
      if (!res.ok) throw new Error("College not found");
      return res.json();
    },
    enabled: !!collegeCode,
  });

  const { data: assignment, isLoading: assignmentLoading, error: assignmentError } = useQuery<PublicAssignment>({
    queryKey: ["/api/public", collegeCode, "assignments", assignmentSlug],
    queryFn: async () => {
      const res = await fetch(`/api/public/${collegeCode}/assignments/${assignmentSlug}`);
      if (!res.ok) throw new Error("Assignment not found");
      return res.json();
    },
    enabled: !!college && !!assignmentSlug,
  });

  const submitMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/public/${collegeCode}/assignments/${assignmentSlug}/submit`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Submission Received!",
        description: "Your assignment has been submitted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
      }
    },
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "text/csv": [".csv"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/gif": [".gif"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentName || !studentId || !file) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields and upload a file.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("studentName", studentName);
    formData.append("studentId", studentId);
    formData.append("file", file);

    submitMutation.mutate(formData);
  };

  const resetForm = () => {
    setStudentName("");
    setStudentId("");
    setFile(null);
    setIsSubmitted(false);
  };

  if (collegeLoading || assignmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (collegeError || !college) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">College Not Found</CardTitle>
            <CardDescription>
              The college portal you're looking for doesn't exist or is inactive.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (assignmentError || !assignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Assignment Not Found</CardTitle>
            <CardDescription>
              This assignment doesn't exist or is no longer available for submission.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Submission Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your submission for "{assignment.title}" has been received. You will receive your grade once it's been reviewed.
            </p>
            <Button onClick={resetForm} data-testid="button-submit-another">
              Submit Another File
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-college-name">{college.name}</h1>
          <p className="text-gray-600 mt-2">Student Assignment Submission Portal</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {assignment.title}
            </CardTitle>
            {assignment.description && (
              <CardDescription className="text-base mt-2">
                {assignment.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Award className="h-4 w-4" />
                <span>Max Points: {assignment.maxPoints}</span>
              </div>
              {assignment.dueDate && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submit Your Work</CardTitle>
            <CardDescription>
              Enter your details and upload your submission file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentName">Full Name</Label>
                  <Input
                    id="studentName"
                    placeholder="Enter your full name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                    data-testid="input-student-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    placeholder="Enter your student ID"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    data-testid="input-student-id"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload Your Submission</Label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50"}
                    ${file ? "bg-green-50 border-green-300" : ""}`}
                  data-testid="dropzone-file"
                >
                  <input {...getInputProps()} data-testid="input-file" />
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-700" data-testid="text-file-name">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">
                        {isDragActive ? "Drop your file here" : "Drag and drop your file here, or click to browse"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">Supported: PDF, DOC, DOCX, PPTX, XLSX, XLS, CSV, TXT, MD, PNG, JPG, GIF (max 10MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitMutation.isPending || !studentName || !studentId || !file}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Assignment
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-gray-500 text-sm mt-6">
          Having trouble? Contact your professor or institution administrator.
        </p>
      </div>
    </div>
  );
}
