import { storage } from "../storage";
import { processUploadedFile } from "./fileProcessor";
import { gradeAssignment } from "./openai";

// Process submissions that need Vision API processing for image-based content
export async function processVisionSubmissions(): Promise<void> {
  console.log("Checking for submissions needing Vision processing...");
  
  try {
    const visionSubmissions = await storage.getSubmissionsNeedingVisionProcessing();
    
    if (visionSubmissions.length === 0) {
      console.log("No submissions need Vision processing.");
      return;
    }
    
    console.log(`Found ${visionSubmissions.length} submissions needing Vision processing.`);
    
    for (const submission of visionSubmissions) {
      try {
        if (!submission.rawFileData || !submission.fileMimeType) {
          console.log(`Submission ${submission.id} missing file data, marking as complete.`);
          await storage.updateSubmission(submission.id, { 
            needsVisionProcessing: false,
            content: "[Error: Original file data not available for processing]"
          });
          continue;
        }
        
        console.log(`Vision processing submission ${submission.id} for student ${submission.studentName}...`);
        
        // Convert base64 back to buffer and process with full Vision API
        const fileBuffer = Buffer.from(submission.rawFileData, 'base64');
        const processedFile = await processUploadedFile(
          fileBuffer,
          submission.fileName || 'file',
          submission.fileMimeType,
          false // Full processing with Vision API
        );
        
        // Update submission with extracted content and clear raw file data
        await storage.updateSubmission(submission.id, {
          content: processedFile.content,
          needsVisionProcessing: false,
          rawFileData: null, // Clear raw data to save space
        });
        
        console.log(`Vision processing completed for submission ${submission.id}`);
        
        // Now grade the submission
        const assignment = await storage.getAssignment(submission.assignmentId);
        if (assignment) {
          const existingResult = await storage.getGradingResult(submission.id);
          if (!existingResult) {
            console.log(`Grading submission ${submission.id}...`);
            const gradingResult = await gradeAssignment({
              caseStudyContent: assignment.caseStudyContent,
              studentResponse: processedFile.content,
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
          }
        }
      } catch (error) {
        console.error(`Failed to Vision-process submission ${submission.id}:`, error);
        // Mark as complete to avoid retrying forever
        await storage.updateSubmission(submission.id, { 
          needsVisionProcessing: false,
          content: `[Vision processing failed: ${(error as Error).message}]`
        });
      }
    }
    
    console.log("Finished Vision processing.");
  } catch (error) {
    console.error("Error in Vision processor:", error);
  }
}

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
        // Skip if needs Vision processing (handled by processVisionSubmissions)
        if (submission.needsVisionProcessing) {
          continue;
        }
        
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
        
        if (submission.content.startsWith('[Processing file...]') || submission.content.startsWith('[File processing failed') || submission.content.startsWith('[Processing images')) {
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
  // Start Vision processing immediately (higher priority)
  setTimeout(() => {
    processVisionSubmissions();
  }, 3000);
  
  // Start regular grading after Vision processing
  setTimeout(() => {
    processPendingSubmissions();
  }, 5000);
  
  // Run Vision processing every 30 seconds for faster turnaround
  setInterval(() => {
    processVisionSubmissions();
  }, 30 * 1000);
  
  // Run regular grading every 5 minutes
  setInterval(() => {
    processPendingSubmissions();
  }, 5 * 60 * 1000);
}
