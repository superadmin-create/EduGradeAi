import { type User, type InsertUser, type Assignment, type InsertAssignment, type Submission, type InsertSubmission, type GradingResult, type InsertGradingResult } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Assignment operations
  getAssignment(id: string): Promise<Assignment | undefined>;
  getAssignments(userId: string): Promise<Assignment[]>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: string, assignment: Partial<Assignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;

  // Submission operations
  getSubmission(id: string): Promise<Submission | undefined>;
  getSubmissions(assignmentId: string): Promise<Submission[]>;
  getSubmissionsByStudent(studentId: string): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: string, submission: Partial<Submission>): Promise<Submission | undefined>;

  // Grading operations
  getGradingResult(submissionId: string): Promise<GradingResult | undefined>;
  getGradingResults(assignmentId: string): Promise<GradingResult[]>;
  createGradingResult(result: InsertGradingResult): Promise<GradingResult>;

  // Statistics
  getAssignmentStats(userId: string): Promise<{
    totalAssignments: number;
    pendingGrading: number;
    totalStudents: number;
    averageGrade: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private assignments: Map<string, Assignment>;
  private submissions: Map<string, Submission>;
  private gradingResults: Map<string, GradingResult>;

  constructor() {
    this.users = new Map();
    this.assignments = new Map();
    this.submissions = new Map();
    this.gradingResults = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "professor"
    };
    this.users.set(id, user);
    return user;
  }

  // Assignment operations
  async getAssignment(id: string): Promise<Assignment | undefined> {
    return this.assignments.get(id);
  }

  async getAssignments(userId: string): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).filter(
      (assignment) => assignment.userId === userId,
    );
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const id = randomUUID();
    const assignment: Assignment = {
      id,
      title: insertAssignment.title,
      course: insertAssignment.course,
      description: insertAssignment.description || null,
      questions: insertAssignment.questions as Array<{
        id: string;
        question: string;
        expectedAnswer: string;
        points: number;
      }>,
      totalPoints: insertAssignment.totalPoints,
      dueDate: null,
      createdAt: new Date(),
      userId: insertAssignment.userId,
    };
    this.assignments.set(id, assignment);
    return assignment;
  }

  async updateAssignment(id: string, updateData: Partial<Assignment>): Promise<Assignment | undefined> {
    const assignment = this.assignments.get(id);
    if (!assignment) return undefined;
    
    const updated = { ...assignment, ...updateData };
    this.assignments.set(id, updated);
    return updated;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    return this.assignments.delete(id);
  }

  // Submission operations
  async getSubmission(id: string): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }

  async getSubmissions(assignmentId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(
      (submission) => submission.assignmentId === assignmentId,
    );
  }

  async getSubmissionsByStudent(studentId: string): Promise<Submission[]> {
    return Array.from(this.submissions.values()).filter(
      (submission) => submission.studentId === studentId,
    );
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = randomUUID();
    const submission: Submission = {
      ...insertSubmission,
      id,
      submittedAt: new Date(),
      isGraded: false,
      fileName: insertSubmission.fileName || null,
    };
    this.submissions.set(id, submission);
    return submission;
  }

  async updateSubmission(id: string, updateData: Partial<Submission>): Promise<Submission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;
    
    const updated = { ...submission, ...updateData };
    this.submissions.set(id, updated);
    return updated;
  }

  // Grading operations
  async getGradingResult(submissionId: string): Promise<GradingResult | undefined> {
    return Array.from(this.gradingResults.values()).find(
      (result) => result.submissionId === submissionId,
    );
  }

  async getGradingResults(assignmentId: string): Promise<GradingResult[]> {
    const submissions = await this.getSubmissions(assignmentId);
    const submissionIds = submissions.map(s => s.id);
    return Array.from(this.gradingResults.values()).filter(
      (result) => submissionIds.includes(result.submissionId),
    );
  }

  async createGradingResult(insertResult: InsertGradingResult): Promise<GradingResult> {
    const id = randomUUID();
    const result: GradingResult = {
      id,
      submissionId: insertResult.submissionId,
      aiAnalysis: {
        overallScore: insertResult.aiAnalysis.overallScore,
        maxScore: insertResult.aiAnalysis.maxScore,
        percentage: insertResult.aiAnalysis.percentage,
        questionScores: insertResult.aiAnalysis.questionScores as Array<{
          questionId: string;
          score: number;
          maxScore: number;
          feedback: string;
          reasoning: string;
        }>,
        generalFeedback: insertResult.aiAnalysis.generalFeedback,
        strengths: insertResult.aiAnalysis.strengths as string[],
        improvements: insertResult.aiAnalysis.improvements as string[],
      },
      finalScore: insertResult.finalScore,
      maxScore: insertResult.maxScore,
      percentage: insertResult.percentage,
      feedback: insertResult.feedback,
      gradedAt: new Date(),
    };
    this.gradingResults.set(id, result);
    
    // Update submission to mark as graded
    await this.updateSubmission(result.submissionId, { isGraded: true });
    
    return result;
  }

  // Statistics
  async getAssignmentStats(userId: string): Promise<{
    totalAssignments: number;
    pendingGrading: number;
    totalStudents: number;
    averageGrade: number;
  }> {
    const userAssignments = await this.getAssignments(userId);
    const totalAssignments = userAssignments.length;

    let pendingGrading = 0;
    const studentIds = new Set<string>();
    let totalGrades = 0;
    let gradeCount = 0;

    for (const assignment of userAssignments) {
      const submissions = await this.getSubmissions(assignment.id);
      const ungradedSubmissions = submissions.filter(s => !s.isGraded);
      pendingGrading += ungradedSubmissions.length;

      submissions.forEach(s => studentIds.add(s.studentId));

      const results = await this.getGradingResults(assignment.id);
      results.forEach(r => {
        totalGrades += r.percentage;
        gradeCount++;
      });
    }

    const averageGrade = gradeCount > 0 ? Math.round(totalGrades / gradeCount) : 0;

    return {
      totalAssignments,
      pendingGrading,
      totalStudents: studentIds.size,
      averageGrade,
    };
  }
}

export const storage = new MemStorage();
