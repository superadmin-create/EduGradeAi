import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const colleges = pgTable("colleges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  quota: integer("quota"),
  usedQuota: integer("used_quota").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("professor"),
  collegeId: varchar("college_id").references(() => colleges.id),
});

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  caseStudyContent: text("case_study_content").notNull(),
  maxPoints: integer("max_points").notNull().default(100),
  dueDate: timestamp("due_date"),
  allowedEmails: text("allowed_emails").array(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
});

export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => assignments.id),
  studentName: text("student_name").notNull(),
  studentId: text("student_id").notNull(),
  studentEmail: text("student_email"),
  content: text("content").notNull(),
  fileName: text("file_name"),
  fileMimeType: text("file_mime_type"),
  rawFileData: text("raw_file_data"),
  needsVisionProcessing: boolean("needs_vision_processing").default(false).notNull(),
  submittedAt: timestamp("submitted_at").default(sql`now()`).notNull(),
  isGraded: boolean("is_graded").default(false).notNull(),
});

export const gradingResults = pgTable("grading_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => submissions.id),
  aiAnalysis: jsonb("ai_analysis").notNull().$type<{
    grade: string;
    score: number;
    maxScore: number;
    percentage: number;
    feedback: string;
    improvements: string[];
    reasoning: string;
  }>(),
  finalScore: integer("final_score").notNull(),
  maxScore: integer("max_score").notNull(),
  percentage: integer("percentage").notNull(),
  feedback: text("feedback").notNull(),
  gradedAt: timestamp("graded_at").default(sql`now()`).notNull(),
});

export const plagiarismResults = pgTable("plagiarism_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => submissions.id),
  isAiGenerated: boolean("is_ai_generated").notNull(),
  aiConfidence: integer("ai_confidence").notNull(),
  aiExplanation: text("ai_explanation"),
  similarSubmissions: jsonb("similar_submissions").$type<{
    submissionId: string;
    studentName: string;
    studentId: string;
    similarityPercentage: number;
    matchedPhrases: string[];
  }[]>(),
  overallSimilarityScore: integer("overall_similarity_score").notNull().default(0),
  checkedAt: timestamp("checked_at").default(sql`now()`).notNull(),
});

export const otpRequests = pgTable("otp_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  collegeId: varchar("college_id").notNull(),
  assignmentId: varchar("assignment_id"),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, verified, expired
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
}).extend({
  maxPoints: z.number().min(1).max(1000),
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  submittedAt: true,
  isGraded: true,
  needsVisionProcessing: true,
});

export const insertGradingResultSchema = createInsertSchema(gradingResults).omit({
  id: true,
  gradedAt: true,
});

export const insertCollegeSchema = createInsertSchema(colleges).omit({
  id: true,
  createdAt: true,
  usedQuota: true,
});

export const insertPlagiarismResultSchema = createInsertSchema(plagiarismResults).omit({
  id: true,
  checkedAt: true,
});

export const insertOtpRequestSchema = createInsertSchema(otpRequests).omit({
  id: true,
  createdAt: true,
  attempts: true,
  status: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const loginSchema = z.object({
  collegeCode: z.string().min(1, "College code is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const otpRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
  assignmentId: z.string().optional(),
});

export const otpVerifySchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export type OtpRequestData = z.infer<typeof otpRequestSchema>;
export type OtpVerifyData = z.infer<typeof otpVerifySchema>;

export type College = typeof colleges.$inferSelect;
export type User = typeof users.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type GradingResult = typeof gradingResults.$inferSelect;
export type PlagiarismResult = typeof plagiarismResults.$inferSelect;
export type OtpRequest = typeof otpRequests.$inferSelect;

export type InsertCollege = z.infer<typeof insertCollegeSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type InsertGradingResult = z.infer<typeof insertGradingResultSchema>;
export type InsertPlagiarismResult = z.infer<typeof insertPlagiarismResultSchema>;
export type InsertOtpRequest = z.infer<typeof insertOtpRequestSchema>;
export type LoginData = z.infer<typeof loginSchema>;
