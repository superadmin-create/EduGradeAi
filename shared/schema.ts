import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("professor"),
});

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  caseStudyContent: text("case_study_content").notNull(),
  maxPoints: integer("max_points").notNull().default(100),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
});

export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => assignments.id),
  studentName: text("student_name").notNull(),
  studentId: text("student_id").notNull(),
  content: text("content").notNull(),
  fileName: text("file_name"),
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
});

export const insertGradingResultSchema = createInsertSchema(gradingResults).omit({
  id: true,
  gradedAt: true,
});

export type User = typeof users.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type GradingResult = typeof gradingResults.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type InsertGradingResult = z.infer<typeof insertGradingResultSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});
