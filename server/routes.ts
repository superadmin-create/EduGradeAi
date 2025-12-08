import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { insertAssignmentSchema, insertSubmissionSchema, loginSchema, colleges } from "@shared/schema";
import { gradeAssignment } from "./services/openai";
import { processUploadedFile, validateFileUpload } from "./services/fileProcessor";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

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
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
      store: new SessionStore({
        checkPeriod: 86400000, // 24 hours
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
      // Return only basic info for students (no grading criteria)
      const publicAssignments = allAssignments.map(a => ({
        id: a.id,
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

  // Student submission (public - no auth required)
  app.post("/api/public/:collegeCode/assignments/:assignmentId/submit", upload.single("file"), async (req, res) => {
    try {
      const college = await storage.getCollegeByCode(req.params.collegeCode);
      if (!college || !college.isActive) {
        return res.status(404).json({ message: "College not found" });
      }

      const assignment = await storage.getAssignment(req.params.assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Verify assignment belongs to this college
      const collegeAssignments = await storage.getAssignmentsByCollege(college.id);
      const assignmentBelongsToCollege = collegeAssignments.some(a => a.id === assignment.id);
      if (!assignmentBelongsToCollege) {
        return res.status(403).json({ message: "This assignment does not belong to this college" });
      }

      // Validate student name and ID
      const { studentName, studentId } = req.body;
      if (!studentName || !studentId) {
        return res.status(400).json({ message: "Student name and ID are required" });
      }

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
        
        // Check if content is mostly empty (likely image-based PDF/PPTX that needs Vision processing)
        const contentWithoutPageMarkers = content.replace(/---\s*Page\s*\d+\s*---/g, '').replace(/---\s*Slide\s*\d+\s*---/g, '').trim();
        const hasSubstantiveContent = contentWithoutPageMarkers.length > 50;
        
        if (!hasSubstantiveContent) {
          // Store raw file for background Vision processing
          rawFileData = req.file.buffer.toString('base64');
          fileMimeType = req.file.mimetype;
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
        content,
        fileName,
        rawFileData,
        fileMimeType,
      });
      
      // Flag for Vision processing if needed
      if (needsVisionProcessing) {
        await storage.updateSubmission(submission.id, { needsVisionProcessing: true });
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
            assignmentTitle: assignment.title,
            studentName: submission.studentName,
            studentId: submission.studentId,
            fileName: submission.fileName,
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
