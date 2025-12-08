import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface GradingRequest {
  caseStudyContent: string;
  studentResponse: string;
  maxPoints: number;
  assignmentTitle: string;
}

interface GradingResponse {
  grade: string; // A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F
  score: number;
  maxScore: number;
  percentage: number;
  feedback: string; // 3-5 sentences highlighting strengths
  improvements: string[]; // 2-3 actionable suggestions
  reasoning: string;
}

export async function gradeAssignment(request: GradingRequest): Promise<GradingResponse> {
  try {
    const prompt = `
You are an AI Assignment Checker evaluating a student's case study assignment.

ASSIGNMENT: ${request.assignmentTitle}
MAX POINTS: ${request.maxPoints}

CASE STUDY:
${request.caseStudyContent}

STUDENT RESPONSE:
${request.studentResponse}

Evaluate this assignment carefully and check these key aspects:
- Understanding of the topic
- Depth of analysis
- Structure and clarity of writing
- Originality and critical thinking
- Relevance to the given question/case
- Grammar, spelling, and presentation

Respond with a JSON object in this exact format:
{
  "grade": "letter grade from A+ to F (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F)",
  "score": number (0 to ${request.maxPoints}),
  "maxScore": ${request.maxPoints},
  "percentage": number (0-100),
  "feedback": "3-5 sentences highlighting the student's strengths and what they did well",
  "reasoning": "brief explanation of how you arrived at this grade",
  "improvements": ["2-3 clear, actionable suggestions for improvement"]
}

Be objective, fair, professional, constructive, and concise. Do not rewrite the student's work.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an AI Assignment Checker. Be objective, fair, professional, constructive, and concise. Always respond with valid JSON in the exact format requested. Give grades from A+ to F based on overall quality."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and ensure all required fields are present
    const score = Math.max(0, Math.min(request.maxPoints, result.score || 0));
    const percentage = Math.round((score / request.maxPoints) * 100);
    
    return {
      grade: result.grade || "F",
      score,
      maxScore: request.maxPoints,
      percentage,
      feedback: result.feedback || "No feedback provided",
      reasoning: result.reasoning || "No reasoning provided",
      improvements: result.improvements || []
    };

  } catch (error) {
    console.error("Error grading assignment:", error);
    throw new Error("Failed to grade assignment: " + (error as Error).message);
  }
}

export async function extractTextFromContent(content: string, fileName?: string): Promise<string> {
  try {
    // If it's already text content, return as is
    if (fileName && !fileName.match(/\.(pdf|doc|docx)$/i)) {
      return content;
    }

    // For now, we'll assume content is already extracted text
    // In a real implementation, you would use libraries like pdf-parse for PDFs
    return content;

  } catch (error) {
    console.error("Error extracting text:", error);
    throw new Error("Failed to extract text from file: " + (error as Error).message);
  }
}

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

export async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  try {
    // Limit base64 size - if too large, skip
    if (imageBase64.length > 5 * 1024 * 1024) { // 5MB base64 limit
      console.log("Image too large for Vision API, skipping...");
      return "[Image too large for processing]";
    }

    const apiCall = openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at reading and transcribing text from images, especially student assignments and academic documents. You excel at:

1. HANDWRITTEN TEXT: Carefully read and transcribe handwritten content, even if the handwriting is messy, cursive, or difficult to read. Make your best interpretation of unclear words based on context.

2. PRINTED TEXT: Extract all typed/printed text including headings, paragraphs, bullet points, captions, and labels.

3. MIXED CONTENT: Handle documents that combine handwriting with printed text, forms, worksheets, and answer sheets.

4. DIAGRAMS & CHARTS: Describe diagrams and extract any text labels, annotations, or handwritten notes on them.

5. STUDENT WORK: This is likely a student assignment submission, so pay special attention to:
   - Handwritten answers on worksheets or exam papers
   - Notes and annotations
   - Math equations and formulas (use appropriate notation)
   - Corrections or strikethrough text

Preserve the structure and flow of the content. If you cannot read something clearly, indicate it with [unclear] but try your best to interpret based on context.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please carefully extract and transcribe ALL text from this image. This is a student assignment submission. Pay special attention to any HANDWRITTEN content - read it carefully and transcribe it as accurately as possible. Include all visible text: handwritten answers, printed questions, headings, bullet points, diagrams with labels, and any annotations."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4096
    });

    // Add 60 second timeout per image
    const response = await withTimeout(apiCall, 60000, "Vision API timeout after 60 seconds");
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error extracting text from image:", error);
    return ""; // Return empty string on error to continue processing
  }
}

export async function extractTextFromMultipleImages(images: Array<{base64: string, mimeType: string}>): Promise<string> {
  const results: string[] = [];
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      const text = await extractTextFromImage(image.base64, image.mimeType);
      if (text.trim()) {
        results.push(`--- Image/Slide ${i + 1} ---\n${text}`);
      }
    } catch (error) {
      console.error(`Error processing image ${i + 1}:`, error);
    }
  }
  
  return results.join('\n\n');
}

// Process an entire PDF file with GPT-4o Vision by sending it as base64
export async function extractTextFromPDFWithVision(pdfBase64: string): Promise<string> {
  try {
    // PDF files can be quite large - check size
    const base64SizeMB = (pdfBase64.length * 3 / 4) / (1024 * 1024);
    console.log(`Processing PDF with Vision API, size: ${base64SizeMB.toFixed(2)} MB`);
    
    if (base64SizeMB > 15) {
      return "[PDF too large for Vision processing - maximum 15MB. Please submit a smaller file.]";
    }

    const apiCall = openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at reading and transcribing content from PDF documents, especially student assignments and academic work. You excel at:

1. HANDWRITTEN TEXT: Carefully read and transcribe handwritten content, even if messy or difficult to read.
2. PRINTED TEXT: Extract all typed/printed text including headings, paragraphs, bullet points.
3. SCANNED DOCUMENTS: Handle scanned pages with text, images, diagrams.
4. MIXED CONTENT: Process documents combining text, images, charts, and handwriting.
5. PRESENTATION SLIDES: Extract content from slide-based PDFs.

Extract ALL visible text from every page. Preserve structure and formatting. For diagrams, describe what you see and extract any text labels.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract ALL text content from this PDF document. This is a student assignment submission. Read every page carefully and transcribe all visible text including handwritten content, printed text, slide content, diagram labels, and annotations. Organize the output by page if there are multiple pages."
            },
            {
              type: "file",
              file: {
                filename: "document.pdf",
                file_data: `data:application/pdf;base64,${pdfBase64}`
              }
            } as any
          ]
        }
      ],
      max_tokens: 8192
    });

    const response = await withTimeout(apiCall, 120000, "PDF Vision API timeout after 2 minutes");
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error extracting text from PDF with Vision:", error);
    throw error; // Re-throw to let caller handle
  }
}
