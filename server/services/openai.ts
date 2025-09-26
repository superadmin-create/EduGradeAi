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
  score: number;
  maxScore: number;
  percentage: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  reasoning: string;
}

export async function gradeAssignment(request: GradingRequest): Promise<GradingResponse> {
  try {
    const prompt = `
You are an expert academic grader evaluating a student's response to a case study assignment.

ASSIGNMENT: ${request.assignmentTitle}
MAX POINTS: ${request.maxPoints}

CASE STUDY:
${request.caseStudyContent}

STUDENT RESPONSE:
${request.studentResponse}

Please evaluate this student's response to the case study. Consider the following criteria:
- Understanding of the case study scenario
- Quality of analysis and critical thinking
- Application of relevant concepts and theories
- Depth of insight and reasoning
- Clarity and organization of response
- Use of evidence from the case study

Respond with a JSON object in this exact format:
{
  "score": number (0 to ${request.maxPoints}),
  "maxScore": ${request.maxPoints},
  "percentage": number (0-100),
  "feedback": "detailed feedback explaining the grade and what the student did well or could improve",
  "reasoning": "explanation of how you arrived at this score",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert academic grader specializing in case study evaluation. Provide fair, detailed, and constructive feedback. Always respond with valid JSON in the exact format requested."
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
      score,
      maxScore: request.maxPoints,
      percentage,
      feedback: result.feedback || "No feedback provided",
      reasoning: result.reasoning || "No reasoning provided",
      strengths: result.strengths || [],
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
