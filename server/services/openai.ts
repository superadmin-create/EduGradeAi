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

export async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts all text content from images. Extract ALL visible text including headings, paragraphs, bullet points, captions, labels, handwritten text, and any other textual content. Preserve the structure and formatting as much as possible. If there are diagrams or charts, describe them briefly and extract any text labels."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract all text content from this image. Include all visible text, headings, bullet points, and any textual information visible in charts, diagrams, or slides."
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
