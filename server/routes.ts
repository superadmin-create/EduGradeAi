import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { insertAssignmentSchema, insertSubmissionSchema, loginSchema, colleges } from "@shared/schema";
import { gradeAssignment } from "./services/openai";
import { processUploadedFile, validateFileUpload } from "./services/fileProcessor";
import { checkPlagiarism, getPlagiarismResult } from "./services/plagiarismService";
import { sendSubmissionConfirmationEmail, sendOtpEmail, sendEvaluationEmail } from "./services/emailService";
import { otpRequestSchema, otpVerifySchema } from "@shared/schema";
import crypto from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Generate URL-friendly slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    collegeId: string;
    collegeName: string;
    userName: string;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const SessionStore = MemoryStore(session);

async function initializeColleges() {
  const existingSXCA = await storage.getCollegeByCode("SXCA");
  
  if (!existingSXCA) {
    const college = await storage.createCollege({
      name: "SXCA College",
      code: "SXCA",
      quota: 100,
      isActive: true,
    });
    
    await db.insert(users).values({
      username: "admin",
      password: "sxca2024",
      name: "SXCA Administrator",
      role: "professor",
      collegeId: college.id,
    });
    
    console.log("SXCA College created with admin user");
  }
  
  const existingLeapup = await storage.getCollegeByCode("LEAPUP");
  
  if (!existingLeapup) {
    const college = await storage.createCollege({
      name: "Leapup",
      code: "LEAPUP",
      quota: null,
      isActive: true,
    });
    
    await db.insert(users).values({
      username: "admin",
      password: "leapup2025",
      name: "Leapup Administrator",
      role: "professor",
      collegeId: college.id,
    });
    
    console.log("Leapup (Main Admin) created with unlimited quota");
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "ai-grader-secret-key",
      resave: true,
      saveUninitialized: false,
      rolling: true, // Extend session on each request
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax',
      },
      store: new SessionStore({
        checkPeriod: 24 * 60 * 60 * 1000, // Prune expired entries every 24 hours
        stale: false, // Don't return stale sessions
      }),
    })
  );

  await initializeColleges();

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { collegeCode, username, password } = loginSchema.parse(req.body);
      
      const college = await storage.getCollegeByCode(collegeCode);
      if (!college) {
        return res.status(401).json({ message: "Invalid college code" });
      }
      
      if (!college.isActive) {
        return res.status(401).json({ message: "This college account is inactive" });
      }
      
      const user = await storage.getUserByUsernameAndCollege(username, college.id);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.session.userId = user.id;
      req.session.collegeId = college.id;
      req.session.collegeName = college.name;
      req.session.userName = user.name;
      
      res.json({
        user: { id: user.id, name: user.name, role: user.role },
        college: { id: college.id, name: college.name, code: college.code },
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid login data" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ user: null, college: null });
    }
    
    const user = await storage.getUser(req.session.userId);
    const college = req.session.collegeId ? await storage.getCollege(req.session.collegeId) : undefined;
    
    if (!user || !college) {
      return res.json({ user: null, college: null });
    }
    
    res.json({
      user: { id: user.id, name: user.name, role: user.role },
      college: { id: college.id, name: college.name, code: college.code, quota: college.quota, usedQuota: college.usedQuota },
    });
  });

  // Assignment routes
  app.get("/api/assignments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const assignments = await storage.getAssignments(userId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.get("/api/assignments/:id", requireAuth, async (req, res) => {
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

  app.post("/api/assignments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const collegeId = req.session.collegeId!;
      
      const college = await storage.getCollege(collegeId);
      if (college && college.quota !== null && college.usedQuota >= college.quota) {
        return res.status(403).json({ 
          message: "Assignment quota exceeded. Please contact your administrator." 
        });
      }
      
      const validatedData = insertAssignmentSchema.parse({
        ...req.body,
        userId,
      });
      
      const assignment = await storage.createAssignment(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(400).json({ message: "Invalid assignment data", error: (error as Error).message });
    }
  });

  app.put("/api/assignments/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/assignments/:id", requireAuth, async (req, res) => {
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

  // Delete submission
  app.delete("/api/submissions/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteSubmission(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete submission" });
    }
  });

  // Submission routes
  app.get("/api/assignments/:id/submissions", requireAuth, async (req, res) => {
    try {
      const submissions = await storage.getSubmissions(req.params.id);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.post("/api/assignments/:id/submissions", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      
      const college = await storage.getCollege(collegeId);
      if (college && college.quota !== null && college.usedQuota >= college.quota) {
        return res.status(403).json({ 
          message: "Assignment quota exceeded. Please contact your administrator." 
        });
      }
      
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
          
          await storage.incrementCollegeUsedQuota(collegeId);
        } catch (gradingError) {
          console.error("Failed to auto-grade submission:", gradingError);
        }
      }

      res.status(201).json(submission);
    } catch (error) {
      res.status(400).json({ message: "Failed to create submission", error: (error as Error).message });
    }
  });

  app.post("/api/assignments/:id/submissions/batch", requireAuth, upload.array("files"), async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      const college = await storage.getCollege(collegeId);
      if (college && college.quota !== null && college.usedQuota >= college.quota) {
        return res.status(403).json({ 
          message: "Assignment quota exceeded. Please contact your administrator." 
        });
      }

      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          validateFileUpload(file);
          
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
  app.get("/api/submissions/:id", requireAuth, async (req, res) => {
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
  app.post("/api/submissions/:id/grade", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      
      const college = await storage.getCollege(collegeId);
      if (college && college.quota !== null && college.usedQuota >= college.quota) {
        return res.status(403).json({ 
          message: "Grading quota exceeded. Please contact your administrator to increase your quota." 
        });
      }
      
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
      
      await storage.incrementCollegeUsedQuota(collegeId);

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to grade submission", error: (error as Error).message });
    }
  });

  app.post("/api/assignments/:id/grade-all", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const college = await storage.getCollege(collegeId);
      const submissions = await storage.getSubmissions(req.params.id);
      const ungradedSubmissions = submissions.filter(s => !s.isGraded);

      const results = [];
      const errors = [];
      let gradedCount = 0;

      for (const submission of ungradedSubmissions) {
        if (college && college.quota !== null && (college.usedQuota + gradedCount) >= college.quota) {
          errors.push({
            submissionId: submission.id,
            studentName: submission.studentName,
            error: "Quota exceeded"
          });
          continue;
        }

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

          await storage.incrementCollegeUsedQuota(collegeId);
          gradedCount++;
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

  app.get("/api/assignments/:id/results", requireAuth, async (req, res) => {
    try {
      const results = await storage.getGradingResults(req.params.id);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grading results" });
    }
  });

  app.get("/api/submissions/:id/result", requireAuth, async (req, res) => {
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

  // Plagiarism check routes
  app.post("/api/submissions/:id/plagiarism-check", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const result = await checkPlagiarism(req.params.id);
      if (!result) {
        return res.status(500).json({ message: "Failed to perform plagiarism check" });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to check plagiarism", error: (error as Error).message });
    }
  });

  app.get("/api/submissions/:id/plagiarism", requireAuth, async (req, res) => {
    try {
      const result = await getPlagiarismResult(req.params.id);
      if (!result) {
        return res.status(404).json({ message: "Plagiarism result not found" });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plagiarism result" });
    }
  });

  app.post("/api/assignments/:id/check-all-plagiarism", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const submissions = await storage.getSubmissions(req.params.id);
      const results = [];
      const errors = [];

      for (const submission of submissions) {
        try {
          const result = await checkPlagiarism(submission.id);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          errors.push({
            submissionId: submission.id,
            studentName: submission.studentName,
            error: (error as Error).message
          });
        }
      }

      res.json({
        checked: results.length,
        errorCount: errors.length,
        results,
        errors
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check plagiarism", error: (error as Error).message });
    }
  });

  // File download endpoint
  app.get("/api/submissions/:id/download", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify submission belongs to authenticated college
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const assignmentUser = await storage.getUser(assignment.userId);
      if (!assignmentUser || assignmentUser.collegeId !== collegeId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!submission.rawFileData || !submission.fileName) {
        return res.status(404).json({ message: "No file available for this submission" });
      }

      const fileBuffer = Buffer.from(submission.rawFileData, 'base64');
      const mimeType = submission.fileMimeType || 'application/octet-stream';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${submission.fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.send(fileBuffer);
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Regrade submission endpoint
  app.post("/api/submissions/:id/regrade", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Verify submission belongs to authenticated college
      const assignmentUser = await storage.getUser(assignment.userId);
      if (!assignmentUser || assignmentUser.collegeId !== collegeId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check quota
      const college = await storage.getCollege(collegeId);
      if (!college) {
        return res.status(404).json({ message: "College not found" });
      }

      if (college.quota !== null && college.usedQuota >= college.quota) {
        return res.status(403).json({ message: "Grading quota exceeded. Please contact administrator." });
      }

      // Run grading FIRST before deleting existing result (avoid data loss on failure)
      const gradingResult = await gradeAssignment({
        caseStudyContent: assignment.caseStudyContent,
        studentResponse: submission.content,
        maxPoints: assignment.maxPoints,
        assignmentTitle: assignment.title,
      });

      // Only delete existing result after successful grading
      await storage.deleteGradingResult(submission.id);

      // Update quota after successful grading
      await storage.incrementCollegeUsedQuota(collegeId);

      // Save new grading result
      const result = await storage.createGradingResult({
        submissionId: submission.id,
        aiAnalysis: gradingResult,
        finalScore: gradingResult.score,
        maxScore: assignment.maxPoints,
        percentage: gradingResult.percentage,
        feedback: gradingResult.feedback,
      });

      // Update submission status
      await storage.updateSubmission(submission.id, { isGraded: true });

      res.json({ 
        message: "Submission regraded successfully", 
        result: {
          grade: result.aiAnalysis.grade,
          score: result.finalScore,
          maxScore: assignment.maxPoints,
          feedback: result.feedback
        }
      });
    } catch (error) {
      console.error('Regrade error:', error);
      res.status(500).json({ message: "Failed to regrade submission", error: (error as Error).message });
    }
  });

  // Email evaluation to student endpoint
  app.post("/api/submissions/:id/email-evaluation", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Verify submission belongs to authenticated college
      const assignmentUser = await storage.getUser(assignment.userId);
      if (!assignmentUser || assignmentUser.collegeId !== collegeId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!submission.studentEmail) {
        return res.status(400).json({ message: "No email address available for this student" });
      }

      const gradingResult = await storage.getGradingResult(req.params.id);
      if (!gradingResult) {
        return res.status(400).json({ message: "Submission has not been graded yet" });
      }

      const college = await storage.getCollege(collegeId);
      if (!college) {
        return res.status(404).json({ message: "College not found" });
      }

      const percentage = Math.round((gradingResult.finalScore / assignment.maxPoints) * 100);

      const success = await sendEvaluationEmail(
        submission.studentEmail,
        submission.studentName,
        assignment.title,
        college.name,
        gradingResult.aiAnalysis.grade || 'N/A',
        gradingResult.finalScore,
        assignment.maxPoints,
        percentage,
        gradingResult.feedback || 'No feedback provided.'
      );

      if (success) {
        res.json({ message: "Evaluation email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send evaluation email" });
      }
    } catch (error) {
      console.error('Email evaluation error:', error);
      res.status(500).json({ message: "Failed to send evaluation email", error: (error as Error).message });
    }
  });

  // Statistics
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      const stats = await storage.getCollegeStats(collegeId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // ======== PUBLIC STUDENT PORTAL ROUTES ========
  
  // Get college info for student portal
  app.get("/api/public/:collegeCode", async (req, res) => {
    try {
      const college = await storage.getCollegeByCode(req.params.collegeCode);
      if (!college || !college.isActive) {
        return res.status(404).json({ message: "College not found" });
      }
      res.json({ id: college.id, name: college.name, code: college.code });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch college" });
    }
  });

  // Get assignments for student portal (public)
  app.get("/api/public/:collegeCode/assignments", async (req, res) => {
    try {
      const college = await storage.getCollegeByCode(req.params.collegeCode);
      if (!college || !college.isActive) {
        return res.status(404).json({ message: "College not found" });
      }
      
      const allAssignments = await storage.getAssignmentsByCollege(college.id);
      // Return only basic info for students (no grading criteria), include slug
      const publicAssignments = allAssignments.map(a => ({
        id: a.id,
        slug: generateSlug(a.title),
        title: a.title,
        description: a.description,
        maxPoints: a.maxPoints,
        dueDate: a.dueDate,
      }));
      
      res.json(publicAssignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Helper function to find assignment by slug or ID
  async function findAssignmentBySlugOrId(collegeId: string, slugOrId: string) {
    const collegeAssignments = await storage.getAssignmentsByCollege(collegeId);
    
    // First try to find by slug (case-insensitive match)
    const bySlug = collegeAssignments.find(a => generateSlug(a.title) === slugOrId.toLowerCase());
    if (bySlug) return bySlug;
    
    // Fall back to ID lookup
    const assignment = await storage.getAssignment(slugOrId);
    if (assignment && collegeAssignments.some(a => a.id === assignment.id)) {
      return assignment;
    }
    
    return null;
  }

  // Get single assignment for student portal (public) - supports slug or ID
  app.get("/api/public/:collegeCode/assignments/:slugOrId", async (req, res) => {
    try {
      const college = await storage.getCollegeByCode(req.params.collegeCode);
      if (!college || !college.isActive) {
        return res.status(404).json({ message: "College not found" });
      }
      
      const assignment = await findAssignmentBySlugOrId(college.id, req.params.slugOrId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Return only basic info for students (no grading criteria)
      res.json({
        id: assignment.id,
        slug: generateSlug(assignment.title),
        title: assignment.title,
        description: assignment.description,
        maxPoints: assignment.maxPoints,
        dueDate: assignment.dueDate,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignment" });
    }
  });

  // ======== OTP VERIFICATION ROUTES ========

  // Request OTP for email verification
  app.post("/api/public/:collegeCode/otp/request", async (req, res) => {
    try {
      const college = await storage.getCollegeByCode(req.params.collegeCode);
      if (!college || !college.isActive) {
        return res.status(404).json({ message: "College not found" });
      }

      const parsed = otpRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      const { email, assignmentId } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      
      // Hash OTP for storage (simple hash for demo - use bcrypt in production)
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

      // Set expiry to 10 minutes from now
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Store OTP request
      const otpRequest = await storage.createOtpRequest({
        email: normalizedEmail,
        collegeId: college.id,
        assignmentId: assignmentId || null,
        otpHash,
        expiresAt,
      });

      // Send OTP email
      const emailSent = await sendOtpEmail(normalizedEmail, otp, college.name);
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send verification email. Please try again." });
      }

      res.json({ 
        message: "Verification code sent to your email",
        requestId: otpRequest.id,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      console.error("OTP request error:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Verify OTP
  app.post("/api/public/:collegeCode/otp/verify", async (req, res) => {
    try {
      const parsed = otpVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Request ID and OTP are required" });
      }

      const { requestId, otp } = parsed.data;

      const otpRequest = await storage.getOtpRequest(requestId);
      if (!otpRequest) {
        return res.status(404).json({ message: "Invalid verification request" });
      }

      // Check if expired
      if (new Date() > new Date(otpRequest.expiresAt)) {
        await storage.updateOtpRequest(requestId, { status: "expired" });
        return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      // Check if already verified
      if (otpRequest.status === "verified") {
        return res.status(400).json({ message: "This code has already been used" });
      }

      // Check attempt limit (max 5 attempts)
      if (otpRequest.attempts >= 5) {
        await storage.updateOtpRequest(requestId, { status: "expired" });
        return res.status(400).json({ message: "Too many failed attempts. Please request a new code." });
      }

      // Verify OTP
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      if (otpHash !== otpRequest.otpHash) {
        await storage.updateOtpRequest(requestId, { attempts: otpRequest.attempts + 1 });
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Mark as verified
      await storage.updateOtpRequest(requestId, { status: "verified" });

      res.json({ 
        message: "Email verified successfully",
        verified: true,
        email: otpRequest.email
      });
    } catch (error) {
      console.error("OTP verify error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Student submission (public - no auth required) - supports slug or ID
  app.post("/api/public/:collegeCode/assignments/:slugOrId/submit", upload.single("file"), async (req, res) => {
    try {
      const college = await storage.getCollegeByCode(req.params.collegeCode);
      if (!college || !college.isActive) {
        return res.status(404).json({ message: "College not found" });
      }

      const assignment = await findAssignmentBySlugOrId(college.id, req.params.slugOrId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Validate student name, ID, email, and OTP verification
      const { studentName, studentId, studentEmail, otpRequestId } = req.body;
      if (!studentName || !studentId) {
        return res.status(400).json({ message: "Student name and ID are required" });
      }

      // Require OTP verification
      if (!otpRequestId) {
        return res.status(400).json({ message: "Email verification is required. Please verify your email first." });
      }

      // Validate OTP verification
      const otpRequest = await storage.getOtpRequest(otpRequestId);
      if (!otpRequest || otpRequest.status !== "verified") {
        return res.status(400).json({ message: "Email not verified. Please verify your email first." });
      }

      // Use the verified email from OTP request
      const verifiedEmail = otpRequest.email;

      // Validate file exists
      if (!req.file && !req.body.content) {
        return res.status(400).json({ message: "File or content is required" });
      }

      // Validate file if provided
      if (req.file) {
        validateFileUpload(req.file);
      }

      let content = "";
      let fileName = null;
      let rawFileData: string | null = null;
      let fileMimeType: string | null = null;
      let needsVisionProcessing = false;

      // Process file in fast mode (skips Vision API for embedded images, much faster)
      if (req.file) {
        const processedFile = await processUploadedFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          true // fastMode - skip Vision API for embedded images in documents
        );
        content = processedFile.content;
        fileName = processedFile.originalName;
        
        // Always store raw file data for download capability
        rawFileData = req.file.buffer.toString('base64');
        fileMimeType = req.file.mimetype;
        
        // Check if content is mostly empty (likely image-based PDF/PPTX that needs Vision processing)
        const contentWithoutPageMarkers = content.replace(/---\s*Page\s*\d+\s*---/g, '').replace(/---\s*Slide\s*\d+\s*---/g, '').trim();
        const hasSubstantiveContent = contentWithoutPageMarkers.length > 50;
        
        if (!hasSubstantiveContent) {
          needsVisionProcessing = true;
          content = "[Processing images - grading will complete shortly...]";
        }
      } else if (req.body.content) {
        content = req.body.content;
      }

      // Create submission with extracted content (or placeholder if Vision processing needed)
      const submission = await storage.createSubmission({
        assignmentId: assignment.id,
        studentName,
        studentId,
        studentEmail: verifiedEmail,
        content,
        fileName,
        rawFileData,
        fileMimeType,
      });
      
      // Flag for Vision processing if needed
      if (needsVisionProcessing) {
        await storage.updateSubmission(submission.id, { needsVisionProcessing: true });
      }

      // Send confirmation email if student provided email
      if (studentEmail) {
        sendSubmissionConfirmationEmail(
          studentEmail,
          studentName,
          assignment.title,
          college.name,
          submission.submittedAt
        ).catch(err => console.error('Failed to send confirmation email:', err));
      }

      // Respond to student immediately
      res.status(201).json({ 
        message: needsVisionProcessing 
          ? "Submission received! Processing images and grading will complete shortly."
          : "Submission received successfully! Your assignment is being graded.",
        submissionId: submission.id,
        studentName: submission.studentName,
        submittedAt: submission.submittedAt
      });

      // Only grade immediately if no Vision processing needed
      // Vision processing + grading will happen in background processor
      if (!needsVisionProcessing && (college.quota === null || college.usedQuota < college.quota)) {
        (async () => {
          try {
            const gradingResult = await gradeAssignment({
              caseStudyContent: assignment.caseStudyContent,
              studentResponse: content,
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
            
            await storage.incrementCollegeUsedQuota(college.id);
            console.log(`Background grading completed for submission ${submission.id}: ${gradingResult.grade}`);
          } catch (gradingError) {
            console.error("Failed to grade submission:", gradingError);
          }
        })();
      }
    } catch (error) {
      res.status(400).json({ message: "Failed to submit assignment", error: (error as Error).message });
    }
  });

  // ======== EXPORT ROUTES ========
  
  // Get all submissions for a college with optional date filter (for export)
  app.get("/api/export/submissions", requireAuth, async (req, res) => {
    try {
      const collegeId = req.session.collegeId!;
      const { date, assignmentId } = req.query;
      
      const allAssignments = await storage.getAssignmentsByCollege(collegeId);
      
      let targetAssignments = allAssignments;
      if (assignmentId) {
        targetAssignments = allAssignments.filter(a => a.id === assignmentId);
      }

      const exportData = [];
      
      for (const assignment of targetAssignments) {
        const assignmentSubmissions = await storage.getSubmissions(assignment.id);
        
        for (const submission of assignmentSubmissions) {
          // Filter by date if provided
          if (date) {
            const submissionDate = new Date(submission.submittedAt).toISOString().split('T')[0];
            if (submissionDate !== date) continue;
          }
          
          const gradingResult = await storage.getGradingResult(submission.id);
          
          exportData.push({
            id: submission.id,
            assignmentTitle: assignment.title,
            studentName: submission.studentName,
            studentId: submission.studentId,
            fileName: submission.fileName,
            hasFile: !!(submission.rawFileData && submission.fileName),
            submittedAt: submission.submittedAt,
            isGraded: submission.isGraded,
            grade: gradingResult?.aiAnalysis?.grade || null,
            score: gradingResult?.finalScore || null,
            maxScore: gradingResult?.maxScore || null,
            percentage: gradingResult?.percentage || null,
            feedback: gradingResult?.feedback || null,
            gradedAt: gradingResult?.gradedAt || null,
          });
        }
      }
      
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch export data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
