import { storage } from "../storage";
import { processUploadedFile } from "./fileProcessor";
import { gradeAssignment } from "./openai";
import { checkCrossAssignmentSimilarity } from "./crossSimilarityService";

// Lock to prevent concurrent Vision processing
let isVisionProcessing = false;
let lastProcessingStart: number | null = null;

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

// Process submissions that need Vision API processing for image-based content
export async function processVisionSubmissions(): Promise<void> {
  // Skip if already processing (with safety timeout of 3 minutes)
  if (isVisionProcessing) {
    const now = Date.now();
    if (lastProcessingStart && (now - lastProcessingStart) > 180000) {
      console.log("Vision processing stuck for 3+ minutes, resetting lock...");
      isVisionProcessing = false;
    } else {
      console.log("Vision processing already in progress, skipping...");
      return;
    }
  }
  
  console.log("Checking for submissions needing Vision processing...");
  
  try {
    isVisionProcessing = true;
    lastProcessingStart = Date.now();
    
    const visionSubmissions = await storage.getSubmissionsNeedingVisionProcessing();
    
    if (visionSubmissions.length === 0) {
      console.log("No submissions need Vision processing.");
      return;
    }
    
    console.log(`Found ${visionSubmissions.length} submissions needing Vision processing.`);
    
    // Process only ONE submission at a time to avoid timeouts
    const submission = visionSubmissions[0];
    
    try {
      if (!submission.rawFileData || !submission.fileMimeType) {
        console.log(`Submission ${submission.id} missing file data, marking as complete.`);
        await storage.updateSubmission(submission.id, { 
          needsVisionProcessing: false,
          content: "[Error: Original file data not available for processing. Please resubmit your assignment.]"
        });
        return;
      }
      
      console.log(`Vision processing submission ${submission.id} for student ${submission.studentName}...`);
      
      // Convert base64 back to buffer and process with full Vision API
      const fileBuffer = Buffer.from(submission.rawFileData, 'base64');
      
      // Add 2 minute total timeout for file processing
      const processedFile = await withTimeout(
        processUploadedFile(
          fileBuffer,
          submission.fileName || 'file',
          submission.fileMimeType,
          false // Full processing with Vision API
        ),
        120000,
        "File processing timeout after 2 minutes"
      );
      
      // Update submission with extracted content and clear raw file data
      await storage.updateSubmission(submission.id, {
        content: processedFile.content,
        needsVisionProcessing: false,
        rawFileData: null, // Clear raw data to save space
      });
      
      console.log(`Vision processing completed for submission ${submission.id}`);
      
      // Now grade the submission if not already graded
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (assignment) {
        const existingResult = await storage.getGradingResult(submission.id);
        if (!existingResult) {
          console.log(`Grading submission ${submission.id}...`);
          const gradingResult = await withTimeout(
            gradeAssignment({
              caseStudyContent: assignment.caseStudyContent,
              studentResponse: processedFile.content,
              maxPoints: assignment.maxPoints,
              assignmentTitle: assignment.title,
            }),
            60000,
            "Grading timeout after 60 seconds"
          );

          await storage.createGradingResult({
            submissionId: submission.id,
            aiAnalysis: gradingResult,
            finalScore: Math.round(gradingResult.score),
            maxScore: Math.round(gradingResult.maxScore),
            percentage: Math.round(gradingResult.percentage),
            feedback: gradingResult.feedback,
          });
          
          await storage.updateSubmission(submission.id, { isGraded: true });

          // Async cross-assignment similarity check
          const assignment2 = await storage.getAssignment(submission.assignmentId);
          if (assignment2) {
            const assignUser = await storage.getUser(assignment2.userId);
            if (assignUser?.collegeId) {
              checkCrossAssignmentSimilarity(submission.id, assignUser.collegeId).catch(() => {});
            }
          }
          
          console.log(`Grading completed for submission ${submission.id}: ${gradingResult.grade}`);
        } else {
          console.log(`Submission ${submission.id} already graded, updating content only.`);
        }
      }
    } catch (error) {
      console.error(`Failed to Vision-process submission ${submission.id}:`, error);
      // Mark as complete to avoid retrying forever
      await storage.updateSubmission(submission.id, { 
        needsVisionProcessing: false,
        content: `[Vision processing failed: ${(error as Error).message}. Please resubmit your assignment.]`
      });
    }
    
    console.log("Finished Vision processing cycle.");
  } catch (error) {
    console.error("Error in Vision processor:", error);
  } finally {
    isVisionProcessing = false;
    lastProcessingStart = null;
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
        
        // Skip submissions with placeholder content
        if (submission.content.startsWith('[Processing') || 
            submission.content.startsWith('[File processing') ||
            submission.content.startsWith('[Error') ||
            submission.content.startsWith('[Vision')) {
          console.log(`Submission ${submission.id} has placeholder content, skipping.`);
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
          finalScore: Math.round(gradingResult.score),
          maxScore: Math.round(gradingResult.maxScore),
          percentage: Math.round(gradingResult.percentage),
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
