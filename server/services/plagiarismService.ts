import OpenAI from "openai";
import { storage } from "../storage";
import type { Submission, PlagiarismResult } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface SimilarSubmission {
  submissionId: string;
  studentName: string;
  studentId: string;
  similarityPercentage: number;
  matchedPhrases: string[];
}

interface PlagiarismCheckResult {
  isAiGenerated: boolean;
  aiConfidence: number;
  aiExplanation: string;
  similarSubmissions: SimilarSubmission[];
  overallSimilarityScore: number;
}

function calculateTextSimilarity(text1: string, text2: string): { similarity: number; matchedPhrases: string[] } {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const normalizedText1 = normalize(text1);
  const normalizedText2 = normalize(text2);
  
  const words1 = normalizedText1.split(' ').filter(w => w.length > 3);
  const words2 = new Set(normalizedText2.split(' ').filter(w => w.length > 3));
  
  if (words1.length === 0) return { similarity: 0, matchedPhrases: [] };
  
  let matchCount = 0;
  for (const word of words1) {
    if (words2.has(word)) matchCount++;
  }
  
  const wordSimilarity = (matchCount / words1.length) * 100;
  
  const sentences1 = text1.split(/[.!?]+/).map(s => normalize(s)).filter(s => s.length > 20);
  const sentences2 = text2.split(/[.!?]+/).map(s => normalize(s)).filter(s => s.length > 20);
  
  const matchedPhrases: string[] = [];
  let sentenceMatches = 0;
  
  for (const sent1 of sentences1) {
    for (const sent2 of sentences2) {
      const longestCommon = findLongestCommonSubstring(sent1, sent2);
      if (longestCommon.length > 30) {
        if (matchedPhrases.length < 5) {
          matchedPhrases.push(longestCommon.substring(0, 100) + (longestCommon.length > 100 ? '...' : ''));
        }
        sentenceMatches++;
        break;
      }
    }
  }
  
  const sentenceSimilarity = sentences1.length > 0 ? (sentenceMatches / sentences1.length) * 100 : 0;
  
  const similarity = Math.min(100, Math.round((wordSimilarity * 0.4) + (sentenceSimilarity * 0.6)));
  
  return { similarity, matchedPhrases };
}

function findLongestCommonSubstring(str1: string, str2: string): string {
  if (!str1 || !str2) return '';
  
  const minLen = Math.min(str1.length, str2.length);
  if (minLen > 500) {
    str1 = str1.substring(0, 500);
    str2 = str2.substring(0, 500);
  }
  
  let longest = '';
  
  for (let i = 0; i < str1.length; i++) {
    for (let j = 0; j < str2.length; j++) {
      let k = 0;
      while (i + k < str1.length && j + k < str2.length && str1[i + k] === str2[j + k]) {
        k++;
      }
      if (k > longest.length) {
        longest = str1.substring(i, i + k);
      }
    }
  }
  
  return longest;
}

async function checkAiGenerated(content: string): Promise<{ isAiGenerated: boolean; confidence: number; explanation: string }> {
  if (!content || content.trim().length < 100) {
    return { isAiGenerated: false, confidence: 0, explanation: "Content too short to analyze" };
  }

  const contentPreview = content.substring(0, 4000);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI text detection expert. Analyze the following text and determine if it was likely written by AI or a human.
          
Consider these factors:
1. Writing style consistency and natural flow
2. Use of uncommon vocabulary or overly formal language
3. Presence of repetitive patterns or structures
4. Specificity of examples and personal touches
5. Grammar perfection vs natural human errors
6. Creativity and originality of ideas

Respond in JSON format:
{
  "isAiGenerated": boolean,
  "confidence": number (0-100),
  "explanation": "Brief explanation of your analysis"
}`
        },
        {
          role: "user",
          content: `Analyze this text for AI generation:\n\n${contentPreview}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      isAiGenerated: result.isAiGenerated ?? false,
      confidence: result.confidence ?? 0,
      explanation: result.explanation ?? "Analysis complete"
    };
  } catch (error) {
    console.error("Error checking AI generation:", error);
    return { isAiGenerated: false, confidence: 0, explanation: "Error during AI detection analysis" };
  }
}

export async function checkPlagiarism(submissionId: string): Promise<PlagiarismResult | null> {
  try {
    const submission = await storage.getSubmission(submissionId);
    if (!submission) {
      console.error("Submission not found:", submissionId);
      return null;
    }

    if (!submission.content || submission.content.trim().length < 50) {
      console.log("Submission content too short for plagiarism check:", submissionId);
      return null;
    }

    const aiCheck = await checkAiGenerated(submission.content);

    const otherSubmissions = await storage.getSubmissionsForPlagiarismCheck(
      submission.assignmentId,
      submissionId
    );

    const similarSubmissions: SimilarSubmission[] = [];
    let maxSimilarity = 0;

    for (const otherSub of otherSubmissions) {
      if (!otherSub.content || otherSub.content.trim().length < 50) continue;
      
      const { similarity, matchedPhrases } = calculateTextSimilarity(submission.content, otherSub.content);
      
      if (similarity > 20) {
        similarSubmissions.push({
          submissionId: otherSub.id,
          studentName: otherSub.studentName,
          studentId: otherSub.studentId,
          similarityPercentage: similarity,
          matchedPhrases
        });
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      }
    }

    similarSubmissions.sort((a, b) => b.similarityPercentage - a.similarityPercentage);

    const result = await storage.createPlagiarismResult({
      submissionId,
      isAiGenerated: aiCheck.isAiGenerated,
      aiConfidence: aiCheck.confidence,
      aiExplanation: aiCheck.explanation,
      similarSubmissions: similarSubmissions.slice(0, 10),
      overallSimilarityScore: maxSimilarity
    });

    console.log(`Plagiarism check complete for submission ${submissionId}: AI=${aiCheck.isAiGenerated} (${aiCheck.confidence}%), Similarity=${maxSimilarity}%`);
    
    return result;
  } catch (error) {
    console.error("Error during plagiarism check:", error);
    return null;
  }
}

export async function getPlagiarismResult(submissionId: string): Promise<PlagiarismResult | null> {
  const result = await storage.getPlagiarismResult(submissionId);
  return result || null;
}
