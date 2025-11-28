import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertAssignmentSchema, insertSubmissionSchema } from "@shared/schema";
import { gradeAssignment } from "./services/openai";
import { processUploadedFile, validateFileUpload } from "./services/fileProcessor";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

async function initializeDefaultUser() {
  const existingUser = await db.select().from(users).where(eq(users.id, "default-user")).limit(1);
  
  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: "default-user",
      username: "professor",
      password: "demo",
      name: "Shaswat Srivastava",
      role: "professor"
    });
    console.log("Default user created");
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await initializeDefaultUser();
  // Assignment routes
  app.get("/api/assignments", async (req, res) => {
    try {
      // For demo purposes, using a default user ID
      const userId = "default-user";
      const assignments = await storage.getAssignments(userId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.get("/api/assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignment" });
    }
  });

  app.post("/api/assignments", async (req, res) => {
    try {
      const validatedData = insertAssignmentSchema.parse({
        ...req.body,
        userId: "default-user", // For demo purposes
      });
      
      const assignment = await storage.createAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(400).json({ message: "Invalid assignment data", error: (error as Error).message });
    }
  });

  app.put("/api/assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.updateAssignment(req.params.id, req.body);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Submission routes
  app.get("/api/assignments/:id/submissions", async (req, res) => {
    try {
      const submissions = await storage.getSubmissions(req.params.id);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.post("/api/assignments/:id/submissions", upload.single("file"), async (req, res) => {
    try {
      let content = req.body.content || "";
      let fileName = req.body.fileName;

      // Handle file upload
      if (req.file) {
        validateFileUpload(req.file);
        const processedFile = await processUploadedFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        content = processedFile.content;
        fileName = processedFile.originalName;
      }

      const validatedData = insertSubmissionSchema.parse({
        assignmentId: req.params.id,
        studentName: req.body.studentName,
        studentId: req.body.studentId,
        content,
        fileName,
      });

      const submission = await storage.createSubmission(validatedData);

      // Automatically grade the submission
      const assignment = await storage.getAssignment(req.params.id);
      if (assignment) {
        try {
          const gradingResult = await gradeAssignment({
            caseStudyContent: assignment.caseStudyContent,
            studentResponse: submission.content,
            maxPoints: assignment.maxPoints,
            assignmentTitle: assignment.title,
          });

          await storage.createGradingResult({
            submissionId: submission.id,
            aiAnalysis: gradingResult,
            finalScore: gradingResult.score,
            maxScore: gradingResult.maxScore,
            percentage: gradingResult.percentage,
            feedback: gradingResult.feedback,
          });
        } catch (gradingError) {
          console.error("Failed to auto-grade submission:", gradingError);
          // Continue even if grading fails - submission is still saved
        }
      }

      res.status(201).json(submission);
    } catch (error) {
      res.status(400).json({ message: "Failed to create submission", error: (error as Error).message });
    }
  });

  app.post("/api/assignments/:id/submissions/batch", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          validateFileUpload(file);
          
          // Extract student info from filename (e.g., "StudentName_StudentID_Assignment.pdf")
          const nameParts = file.originalname.split('_');
          const studentName = nameParts[0] || `Student_${Date.now()}`;
          const studentId = nameParts[1] || `ID_${Date.now()}`;

          const processedFile = await processUploadedFile(
            file.buffer,
            file.originalname,
            file.mimetype
          );

          const submission = await storage.createSubmission({
            assignmentId: req.params.id,
            studentName,
            studentId,
            content: processedFile.content,
            fileName: processedFile.originalName,
          });

          results.push(submission);
        } catch (error) {
          errors.push({
            fileName: file.originalname,
            error: (error as Error).message
          });
        }
      }

      res.json({
        success: results.length,
        errorCount: errors.length,
        results,
        errors
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to process batch upload", error: (error as Error).message });
    }
  });

  // Get single submission
  app.get("/api/submissions/:id", async (req, res) => {
    try {
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submission" });
    }
  });

  // Grading routes
  app.post("/api/submissions/:id/grade", async (req, res) => {
    try {
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Grade using AI
      const gradingResult = await gradeAssignment({
        caseStudyContent: assignment.caseStudyContent,
        studentResponse: submission.content,
        maxPoints: assignment.maxPoints,
        assignmentTitle: assignment.title,
      });

      // Save grading result
      const result = await storage.createGradingResult({
        submissionId: submission.id,
        aiAnalysis: gradingResult,
        finalScore: gradingResult.score,
        maxScore: gradingResult.maxScore,
        percentage: gradingResult.percentage,
        feedback: gradingResult.feedback,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to grade submission", error: (error as Error).message });
    }
  });

  app.post("/api/assignments/:id/grade-all", async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const submissions = await storage.getSubmissions(req.params.id);
      const ungradedSubmissions = submissions.filter(s => !s.isGraded);

      const results = [];
      const errors = [];

      for (const submission of ungradedSubmissions) {
        try {
          const gradingResult = await gradeAssignment({
            caseStudyContent: assignment.caseStudyContent,
            studentResponse: submission.content,
            maxPoints: assignment.maxPoints,
            assignmentTitle: assignment.title,
          });

          const result = await storage.createGradingResult({
            submissionId: submission.id,
            aiAnalysis: gradingResult,
            finalScore: gradingResult.score,
            maxScore: gradingResult.maxScore,
            percentage: gradingResult.percentage,
            feedback: gradingResult.feedback,
          });

          results.push(result);
        } catch (error) {
          errors.push({
            submissionId: submission.id,
            studentName: submission.studentName,
            error: (error as Error).message
          });
        }
      }

      res.json({
        graded: results.length,
        errorCount: errors.length,
        results,
        errors
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to grade submissions", error: (error as Error).message });
    }
  });

  app.get("/api/assignments/:id/results", async (req, res) => {
    try {
      const results = await storage.getGradingResults(req.params.id);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grading results" });
    }
  });

  app.get("/api/submissions/:id/result", async (req, res) => {
    try {
      const result = await storage.getGradingResult(req.params.id);
      if (!result) {
        return res.status(404).json({ message: "Grading result not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grading result" });
    }
  });

  // Statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getAssignmentStats("default-user");
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
