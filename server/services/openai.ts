import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface Question {
  id: string;
  question: string;
  expectedAnswer: string;
  points: number;
}

interface GradingRequest {
  questions: Question[];
  studentAnswers: string;
  totalPoints: number;
}

interface QuestionScore {
  questionId: string;
  score: number;
  maxScore: number;
  feedback: string;
  reasoning: string;
}

interface GradingResponse {
  overallScore: number;
  maxScore: number;
  percentage: number;
  questionScores: QuestionScore[];
  generalFeedback: string;
  strengths: string[];
  improvements: string[];
}

export async function gradeAssignment(request: GradingRequest): Promise<GradingResponse> {
  try {
    const prompt = `
You are an expert academic grader. Please grade this student's assignment submission carefully and provide detailed feedback.

ASSIGNMENT QUESTIONS AND EXPECTED ANSWERS:
${request.questions.map(q => `
Question ${q.id}: ${q.question}
Expected Answer: ${q.expectedAnswer}
Points: ${q.points}
`).join('\n')}

STUDENT SUBMISSION:
${request.studentAnswers}

Please analyze the student's submission and provide a comprehensive grading response. Grade each question individually based on how well the student's answer matches the expected answer, considering:
- Accuracy and correctness of key concepts
- Completeness of the answer
- Understanding demonstrated
- Quality of explanation

Respond with a JSON object in this exact format:
{
  "overallScore": number,
  "maxScore": ${request.totalPoints},
  "percentage": number (0-100),
  "questionScores": [
    {
      "questionId": "string",
      "score": number,
      "maxScore": number,
      "feedback": "detailed feedback for this question",
      "reasoning": "explanation of why this score was given"
    }
  ],
  "generalFeedback": "overall feedback about the entire submission",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert academic grader. Provide fair, detailed, and constructive feedback. Always respond with valid JSON in the exact format requested."
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
    return {
      overallScore: Math.max(0, Math.min(request.totalPoints, result.overallScore || 0)),
      maxScore: request.totalPoints,
      percentage: Math.max(0, Math.min(100, result.percentage || 0)),
      questionScores: result.questionScores || [],
      generalFeedback: result.generalFeedback || "No general feedback provided",
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
