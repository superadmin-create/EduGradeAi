import { type User, type InsertUser, type Assignment, type InsertAssignment, type Submission, type InsertSubmission, type GradingResult, type InsertGradingResult, type College, type InsertCollege, type PlagiarismResult, type InsertPlagiarismResult, type OtpRequest, type InsertOtpRequest, users, assignments, submissions, gradingResults, colleges, plagiarismResults, otpRequests } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, or, like, lt, gt, inArray } from "drizzle-orm";

export interface IStorage {
  getCollege(id: string): Promise<College | undefined>;
  getCollegeByCode(code: string): Promise<College | undefined>;
  getColleges(): Promise<College[]>;
  createCollege(college: InsertCollege): Promise<College>;
  updateCollege(id: string, data: Partial<College>): Promise<College | undefined>;
  incrementCollegeUsedQuota(collegeId: string): Promise<College | undefined>;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameAndCollege(username: string, collegeId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAssignment(id: string): Promise<Assignment | undefined>;
  getAssignments(userId: string): Promise<Assignment[]>;
  getAssignmentsByCollege(collegeId: string): Promise<Assignment[]>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: string, assignment: Partial<Assignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;

  getSubmission(id: string): Promise<Submission | undefined>;
  getSubmissions(assignmentId: string): Promise<Submission[]>;
  getAllSubmissionsByCollege(collegeId: string): Promise<any[]>;
  getSubmissionsByStudent(studentId: string): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: string, submission: Partial<Submission>): Promise<Submission | undefined>;
  deleteSubmission(id: string): Promise<boolean>;

  getGradingResult(submissionId: string): Promise<GradingResult | undefined>;
  getGradingResults(assignmentId: string): Promise<GradingResult[]>;
  createGradingResult(result: InsertGradingResult): Promise<GradingResult>;
  deleteGradingResult(submissionId: string): Promise<boolean>;
  
  getPendingSubmissions(): Promise<Submission[]>;
  getSubmissionsNeedingVisionProcessing(): Promise<Submission[]>;

  getAssignmentStats(userId: string): Promise<{
    totalAssignments: number;
    pendingGrading: number;
    totalStudents: number;
    averageGrade: number;
  }>;
  
  getCollegeStats(collegeId: string): Promise<{
    totalAssignments: number;
    pendingGrading: number;
    totalStudents: number;
    averageGrade: number;
    quotaUsed: number;
    quotaTotal: number | null | undefined;
  }>;

  getPlagiarismResult(submissionId: string): Promise<PlagiarismResult | undefined>;
  createPlagiarismResult(result: InsertPlagiarismResult): Promise<PlagiarismResult>;
  deletePlagiarismResult(submissionId: string): Promise<boolean>;
  getSubmissionsForPlagiarismCheck(assignmentId: string, excludeSubmissionId: string): Promise<Submission[]>;

  createOtpRequest(request: InsertOtpRequest): Promise<OtpRequest>;
  getOtpRequest(id: string): Promise<OtpRequest | undefined>;
  updateOtpRequest(id: string, data: Partial<OtpRequest>): Promise<OtpRequest | undefined>;
  getRecentOtpRequestsByEmail(email: string, collegeId: string, minutesAgo: number): Promise<OtpRequest[]>;
  cleanupExpiredOtpRequests(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getCollege(id: string): Promise<College | undefined> {
    const [college] = await db.select().from(colleges).where(eq(colleges.id, id));
    return college;
  }

  async getCollegeByCode(code: string): Promise<College | undefined> {
    const [college] = await db.select().from(colleges).where(eq(colleges.code, code.toUpperCase()));
    return college;
  }

  async getColleges(): Promise<College[]> {
    return db.select().from(colleges);
  }

  async createCollege(insertCollege: InsertCollege): Promise<College> {
    const [college] = await db.insert(colleges).values({
      name: insertCollege.name,
      code: insertCollege.code.toUpperCase(),
      quota: insertCollege.quota,
      isActive: insertCollege.isActive ?? true,
    }).returning();
    return college;
  }

  async updateCollege(id: string, data: Partial<College>): Promise<College | undefined> {
    const [updated] = await db.update(colleges)
      .set(data)
      .where(eq(colleges.id, id))
      .returning();
    return updated;
  }

  async incrementCollegeUsedQuota(collegeId: string): Promise<College | undefined> {
    const [updated] = await db.update(colleges)
      .set({ usedQuota: sql`${colleges.usedQuota} + 1` })
      .where(eq(colleges.id, collegeId))
      .returning();
    return updated;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByUsernameAndCollege(username: string, collegeId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.collegeId, collegeId))
    );
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role || "professor"
    }).returning();
    return user;
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
    return assignment;
  }

  async getAssignments(userId: string): Promise<Assignment[]> {
    return db.select().from(assignments).where(eq(assignments.userId, userId));
  }

  async getAssignmentsByCollege(collegeId: string): Promise<Assignment[]> {
    const collegeUsers = await db.select().from(users).where(eq(users.collegeId, collegeId));
    const userIds = collegeUsers.map(u => u.id);
    
    if (userIds.length === 0) return [];
    
    const allAssignments: Assignment[] = [];
    for (const userId of userIds) {
      const userAssignments = await this.getAssignments(userId);
      allAssignments.push(...userAssignments);
    }
    return allAssignments;
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const [assignment] = await db.insert(assignments).values({
      title: insertAssignment.title,
      description: insertAssignment.description || null,
      caseStudyContent: insertAssignment.caseStudyContent,
      maxPoints: insertAssignment.maxPoints,
      dueDate: null,
      userId: insertAssignment.userId,
    }).returning();
    return assignment;
  }

  async updateAssignment(id: string, updateData: Partial<Assignment>): Promise<Assignment | undefined> {
    const [updated] = await db.update(assignments)
      .set(updateData)
      .where(eq(assignments.id, id))
      .returning();
    return updated;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    // First get all submissions for this assignment
    const assignmentSubmissions = await this.getSubmissions(id);
    
    // Delete grading results for each submission
    for (const submission of assignmentSubmissions) {
      await db.delete(gradingResults).where(eq(gradingResults.submissionId, submission.id));
    }
    
    // Delete all submissions for this assignment
    await db.delete(submissions).where(eq(submissions.assignmentId, id));
    
    // Finally delete the assignment
    await db.delete(assignments).where(eq(assignments.id, id));
    return true;
  }

  async getSubmission(id: string): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission;
  }

  async getSubmissions(assignmentId: string): Promise<Submission[]> {
    return db.select().from(submissions).where(eq(submissions.assignmentId, assignmentId));
  }

  async getAllSubmissionsByCollege(collegeId: string): Promise<any[]> {
    const collegeAssignments = await this.getAssignmentsByCollege(collegeId);
    if (collegeAssignments.length === 0) return [];
    const assignmentIds = collegeAssignments.map(a => a.id);
    const allSubs = await db.select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
      studentName: submissions.studentName,
      studentId: submissions.studentId,
      studentEmail: submissions.studentEmail,
      fileName: submissions.fileName,
      submittedAt: submissions.submittedAt,
      isGraded: submissions.isGraded,
    }).from(submissions).where(
      inArray(submissions.assignmentId, assignmentIds)
    );
    return allSubs;
  }

  async getSubmissionsByStudent(studentId: string): Promise<Submission[]> {
    return db.select().from(submissions).where(eq(submissions.studentId, studentId));
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db.insert(submissions).values({
      ...insertSubmission,
      fileName: insertSubmission.fileName || null,
    }).returning();
    return submission;
  }

  async updateSubmission(id: string, updateData: Partial<Submission>): Promise<Submission | undefined> {
    const [updated] = await db.update(submissions)
      .set(updateData)
      .where(eq(submissions.id, id))
      .returning();
    return updated;
  }

  async deleteSubmission(id: string): Promise<boolean> {
    // First delete any associated grading results
    await db.delete(gradingResults).where(eq(gradingResults.submissionId, id));
    // Then delete the submission
    await db.delete(submissions).where(eq(submissions.id, id));
    return true;
  }

  async getGradingResult(submissionId: string): Promise<GradingResult | undefined> {
    const [result] = await db.select().from(gradingResults).where(eq(gradingResults.submissionId, submissionId));
    return result;
  }

  async getGradingResults(assignmentId: string): Promise<GradingResult[]> {
    const assignmentSubmissions = await this.getSubmissions(assignmentId);
    const submissionIds = assignmentSubmissions.map(s => s.id);
    
    if (submissionIds.length === 0) return [];
    
    const results: GradingResult[] = [];
    for (const subId of submissionIds) {
      const [result] = await db.select().from(gradingResults).where(eq(gradingResults.submissionId, subId));
      if (result) results.push(result);
    }
    return results;
  }

  async createGradingResult(insertResult: InsertGradingResult): Promise<GradingResult> {
    const [result] = await db.insert(gradingResults).values({
      submissionId: insertResult.submissionId,
      aiAnalysis: insertResult.aiAnalysis,
      finalScore: insertResult.finalScore,
      maxScore: insertResult.maxScore,
      percentage: insertResult.percentage,
      feedback: insertResult.feedback,
    }).returning();
    
    await this.updateSubmission(result.submissionId, { isGraded: true });
    
    return result;
  }

  async deleteGradingResult(submissionId: string): Promise<boolean> {
    await db.delete(gradingResults).where(eq(gradingResults.submissionId, submissionId));
    return true;
  }

  async getPendingSubmissions(): Promise<Submission[]> {
    return db.select().from(submissions).where(
      or(
        eq(submissions.isGraded, false),
        like(submissions.content, '[Processing file...]%')
      )
    );
  }

  async getSubmissionsNeedingVisionProcessing(): Promise<Submission[]> {
    return db.select().from(submissions).where(
      eq(submissions.needsVisionProcessing, true)
    );
  }

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
      const assignmentSubmissions = await this.getSubmissions(assignment.id);
      const ungradedSubmissions = assignmentSubmissions.filter(s => !s.isGraded);
      pendingGrading += ungradedSubmissions.length;

      assignmentSubmissions.forEach(s => studentIds.add(s.studentId));

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

  async getCollegeStats(collegeId: string): Promise<{
    totalAssignments: number;
    pendingGrading: number;
    totalStudents: number;
    averageGrade: number;
    quotaUsed: number;
    quotaTotal: number | null | undefined;
  }> {
    const college = await this.getCollege(collegeId);
    if (!college) {
      return {
        totalAssignments: 0,
        pendingGrading: 0,
        totalStudents: 0,
        averageGrade: 0,
        quotaUsed: 0,
        quotaTotal: 0,
      };
    }

    const collegeAssignments = await this.getAssignmentsByCollege(collegeId);
    const totalAssignments = collegeAssignments.length;

    let pendingGrading = 0;
    const studentIds = new Set<string>();
    let totalGrades = 0;
    let gradeCount = 0;

    for (const assignment of collegeAssignments) {
      const assignmentSubmissions = await this.getSubmissions(assignment.id);
      const ungradedSubmissions = assignmentSubmissions.filter(s => !s.isGraded);
      pendingGrading += ungradedSubmissions.length;

      assignmentSubmissions.forEach(s => studentIds.add(s.studentId));

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
      quotaUsed: college.usedQuota,
      quotaTotal: college.quota ?? null,
    };
  }

  async getPlagiarismResult(submissionId: string): Promise<PlagiarismResult | undefined> {
    const [result] = await db.select().from(plagiarismResults).where(eq(plagiarismResults.submissionId, submissionId));
    return result;
  }

  async createPlagiarismResult(insertResult: InsertPlagiarismResult): Promise<PlagiarismResult> {
    // Delete existing result if any
    await db.delete(plagiarismResults).where(eq(plagiarismResults.submissionId, insertResult.submissionId));
    
    const [result] = await db.insert(plagiarismResults).values({
      submissionId: insertResult.submissionId,
      isAiGenerated: insertResult.isAiGenerated,
      aiConfidence: insertResult.aiConfidence,
      aiExplanation: insertResult.aiExplanation,
      similarSubmissions: insertResult.similarSubmissions,
      overallSimilarityScore: insertResult.overallSimilarityScore ?? 0,
    }).returning();
    return result;
  }

  async deletePlagiarismResult(submissionId: string): Promise<boolean> {
    await db.delete(plagiarismResults).where(eq(plagiarismResults.submissionId, submissionId));
    return true;
  }

  async getSubmissionsForPlagiarismCheck(assignmentId: string, excludeSubmissionId: string): Promise<Submission[]> {
    const allSubmissions = await this.getSubmissions(assignmentId);
    return allSubmissions.filter(s => s.id !== excludeSubmissionId && s.content && s.content.trim().length > 0);
  }

  async createOtpRequest(request: InsertOtpRequest): Promise<OtpRequest> {
    const [otpRequest] = await db.insert(otpRequests).values({
      email: request.email,
      collegeId: request.collegeId,
      assignmentId: request.assignmentId || null,
      otpHash: request.otpHash,
      expiresAt: request.expiresAt,
    }).returning();
    return otpRequest;
  }

  async getOtpRequest(id: string): Promise<OtpRequest | undefined> {
    const [request] = await db.select().from(otpRequests).where(eq(otpRequests.id, id));
    return request;
  }

  async updateOtpRequest(id: string, data: Partial<OtpRequest>): Promise<OtpRequest | undefined> {
    const [updated] = await db.update(otpRequests)
      .set(data)
      .where(eq(otpRequests.id, id))
      .returning();
    return updated;
  }

  async getRecentOtpRequestsByEmail(email: string, collegeId: string, minutesAgo: number): Promise<OtpRequest[]> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    return db.select().from(otpRequests).where(
      and(
        eq(otpRequests.email, email.toLowerCase()),
        eq(otpRequests.collegeId, collegeId),
        gt(otpRequests.createdAt, cutoffTime)
      )
    );
  }

  async cleanupExpiredOtpRequests(): Promise<number> {
    const result = await db.delete(otpRequests).where(
      lt(otpRequests.expiresAt, new Date())
    ).returning();
    return result.length;
  }
}

export const storage = new DatabaseStorage();
