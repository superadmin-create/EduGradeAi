import { storage } from "../storage";
import { processUploadedFile } from "./fileProcessor";
import { gradeAssignment } from "./openai";

export async function processPendingSubmissions(): Promise<void> {
  console.log("Checking for pending submissions to process...");
  
  try {
    const pendingSubmissions = await storage.getPendingSubmissions();
    
    if (pendingSubmissions.length === 0) {
      console.log("No pending submissions found.");
      return;
    }
    
    console.log(`Found ${pendingSubmissions.length} pending submissions to process.`);
    
    for (const submission of pendingSubmissions) {
      try {
        const assignment = await storage.getAssignment(submission.assignmentId);
        if (!assignment) {
          console.log(`Assignment not found for submission ${submission.id}, skipping.`);
          continue;
        }
        
        const existingResult = await storage.getGradingResult(submission.id);
        if (existingResult) {
          console.log(`Submission ${submission.id} already graded, skipping.`);
          continue;
        }
        
        if (submission.content.startsWith('[Processing file...]') || submission.content.startsWith('[File processing failed')) {
          console.log(`Submission ${submission.id} has processing placeholder, cannot reprocess without original file.`);
          continue;
        }
        
        console.log(`Processing submission ${submission.id} for student ${submission.studentName}...`);
        
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
        
        console.log(`Grading completed for submission ${submission.id}: ${gradingResult.grade}`);
      } catch (error) {
        console.error(`Failed to process submission ${submission.id}:`, error);
      }
    }
    
    console.log("Finished processing pending submissions.");
  } catch (error) {
    console.error("Error in background processor:", error);
  }
}

export function startBackgroundProcessor(): void {
  setTimeout(() => {
    processPendingSubmissions();
  }, 5000);
  
  setInterval(() => {
    processPendingSubmissions();
  }, 5 * 60 * 1000);
}
