import { storage } from "../storage";

interface CrossSimilarSubmission {
  submissionId: string;
  studentName: string;
  studentId: string;
  studentEmail: string | null;
  assignmentId: string;
  assignmentTitle: string;
  similarityPercentage: number;
  matchedPhrases: string[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function calculateTextSimilarity(text1: string, text2: string): { similarity: number; matchedPhrases: string[] } {
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);

  const words1 = norm1.split(" ").filter((w) => w.length > 3);
  const words2 = new Set(norm2.split(" ").filter((w) => w.length > 3));

  if (words1.length === 0) return { similarity: 0, matchedPhrases: [] };

  let matchCount = 0;
  for (const word of words1) {
    if (words2.has(word)) matchCount++;
  }
  const wordSimilarity = (matchCount / words1.length) * 100;

  const sentences1 = text1.split(/[.!?]+/).map((s) => normalize(s)).filter((s) => s.length > 20);
  const sentences2 = text2.split(/[.!?]+/).map((s) => normalize(s)).filter((s) => s.length > 20);

  const matchedPhrases: string[] = [];
  let sentenceMatches = 0;

  for (const sent1 of sentences1) {
    for (const sent2 of sentences2) {
      const common = findLongestCommonSubstring(sent1, sent2);
      if (common.length > 30) {
        if (matchedPhrases.length < 5) {
          matchedPhrases.push(common.substring(0, 100) + (common.length > 100 ? "..." : ""));
        }
        sentenceMatches++;
        break;
      }
    }
  }

  const sentenceSimilarity = sentences1.length > 0 ? (sentenceMatches / sentences1.length) * 100 : 0;
  const similarity = Math.min(100, Math.round(wordSimilarity * 0.4 + sentenceSimilarity * 0.6));

  return { similarity, matchedPhrases };
}

function findLongestCommonSubstring(str1: string, str2: string): string {
  if (!str1 || !str2) return "";
  str1 = str1.substring(0, 500);
  str2 = str2.substring(0, 500);
  let longest = "";
  for (let i = 0; i < str1.length; i++) {
    for (let j = 0; j < str2.length; j++) {
      let k = 0;
      while (i + k < str1.length && j + k < str2.length && str1[i + k] === str2[j + k]) k++;
      if (k > longest.length) longest = str1.substring(i, i + k);
    }
  }
  return longest;
}

/**
 * Run after a submission is graded. Compares it against ALL other submissions
 * across every assignment in the college and saves any similarities found.
 * Fires async — never blocks the grading response.
 */
export async function checkCrossAssignmentSimilarity(
  submissionId: string,
  collegeId: string
): Promise<void> {
  try {
    const submission = await storage.getSubmission(submissionId);
    if (!submission || !submission.content || submission.content.trim().length < 50) return;

    const collegeAssignments = await storage.getAssignmentsByCollege(collegeId);
    const assignmentMap = new Map(collegeAssignments.map((a) => [a.id, a.title]));

    const similarResults: CrossSimilarSubmission[] = [];
    let maxScore = 0;

    for (const assignment of collegeAssignments) {
      const others = await storage.getSubmissions(assignment.id);
      for (const other of others) {
        // Skip self
        if (other.id === submissionId) continue;
        if (!other.content || other.content.trim().length < 50) continue;

        const { similarity, matchedPhrases } = calculateTextSimilarity(
          submission.content,
          other.content
        );

        // Threshold: 40% for cross-assignment (higher bar than same-assignment 20%)
        if (similarity >= 40) {
          similarResults.push({
            submissionId: other.id,
            studentName: other.studentName,
            studentId: other.studentId,
            studentEmail: other.studentEmail ?? null,
            assignmentId: assignment.id,
            assignmentTitle: assignmentMap.get(assignment.id) || assignment.title,
            similarityPercentage: similarity,
            matchedPhrases,
          });
          if (similarity > maxScore) maxScore = similarity;
        }
      }
    }

    // Sort by similarity descending, keep top 20
    similarResults.sort((a, b) => b.similarityPercentage - a.similarityPercentage);
    const top = similarResults.slice(0, 20);

    await storage.saveCrossAssignmentFlag({
      submissionId,
      collegeId,
      similarSubmissions: top,
      maxSimilarityScore: maxScore,
    });

    if (top.length > 0) {
      console.log(
        `[CrossSimilarity] Submission ${submissionId}: ${top.length} similar submissions found across assignments (max ${maxScore}%)`
      );
    }
  } catch (err) {
    console.error("[CrossSimilarity] Error checking cross-assignment similarity:", err);
  }
}
