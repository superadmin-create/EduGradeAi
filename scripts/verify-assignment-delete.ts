import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { assignments, submissions, gradingResults, plagiarismResults, crossAssignmentFlags, otpRequests, users } from "../shared/schema";
import { eq } from "drizzle-orm";

// Integration check: uses only newly created fixtures, never existing assignments.
async function main() {
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  assert.ok(user, "An existing user is required to own the test fixtures");
  const fixtureIds: string[] = [];
  try {
    for (const populated of [false, true]) {
      const [assignment] = await db.insert(assignments).values({
        title: `Assignment deletion verification ${randomUUID()}`,
        caseStudyContent: "Disposable deletion verification fixture",
        userId: user.id,
      }).returning();
      fixtureIds.push(assignment.id);
      let submissionId: string | undefined;
      if (populated) {
        const [submission] = await db.insert(submissions).values({
          assignmentId: assignment.id,
          studentName: "Deletion verification",
          studentId: "verification",
          content: "Disposable verification fixture",
          isGraded: true,
        }).returning();
        submissionId = submission.id;
        await db.insert(gradingResults).values({
          submissionId, aiAnalysis: { grade: "A", score: 10, maxScore: 10, percentage: 100, feedback: "Test", improvements: [], reasoning: "Test" },
          finalScore: 10, maxScore: 10, percentage: 100, feedback: "Test",
        });
        await db.insert(plagiarismResults).values({ submissionId, isAiGenerated: false, aiConfidence: 0 });
        await db.insert(crossAssignmentFlags).values({ submissionId, collegeId: "verification", similarSubmissions: [] });
        await db.insert(otpRequests).values({
          assignmentId: assignment.id, email: "verification@example.invalid",
          collegeId: "verification", otpHash: "not-a-valid-otp", expiresAt: new Date(0),
        });
      }
      assert.equal(await storage.deleteAssignment(assignment.id), true);
      assert.equal(await storage.getAssignment(assignment.id), undefined);
      assert.equal((await storage.getSubmissions(assignment.id)).length, 0);
      assert.equal((await db.select().from(otpRequests).where(eq(otpRequests.assignmentId, assignment.id))).length, 0);
      if (submissionId) {
        for (const table of [gradingResults, plagiarismResults, crossAssignmentFlags]) {
          assert.equal((await db.select().from(table).where(eq(table.submissionId, submissionId))).length, 0);
        }
      }
      assert.equal(await storage.deleteAssignment(assignment.id), false);
      console.log(`PASS: ${populated ? "assignment with submissions and all dependent records" : "empty assignment"}; repeated deletion reports not found`);
    }
  } finally {
    for (const id of fixtureIds) await storage.deleteAssignment(id);
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
