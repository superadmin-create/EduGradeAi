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

/** Threshold for flagging cross-assignment reuse. Higher than the 20% used for
 *  same-assignment plagiarism, because submissions on the same topic naturally
 *  share vocabulary. */
const SIMILARITY_THRESHOLD = 40;

/** Length of word-shingles used for comparison. 5 words is long enough that
 *  incidental overlap is rare but short enough to survive light paraphrasing. */
const SHINGLE_SIZE = 5;

/** Submissions shorter than this are skipped entirely. Real work runs to
 *  thousands of characters; this floor also clears the short system-generated
 *  failure placeholders described below. */
const MIN_CONTENT_LENGTH = 200;

/** Some rows hold a processing-failure notice instead of student work. They are
 *  byte-identical to each other, so without this filter they all match at 100%
 *  and dominate the results. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /processing failed/i,
  /please resubmit your assignment/i,
  /unable to access the contents/i,
];

function isPlaceholderContent(content: string): boolean {
  const head = content.slice(0, 400);
  return PLACEHOLDER_PATTERNS.some((re) => re.test(head));
}

/** A shingle must carry this many characters to count. Some documents come out
 *  of OCR character-spaced ("F o r m a t"), which turns every letter into a
 *  "word"; without this floor a 5-word shingle can be 5 letters and any two
 *  such documents match at ~100%. */
const MIN_SHINGLE_CHARS = 20;

/** Documents whose average word length is below this are character-spaced OCR
 *  artifacts rather than prose, and are excluded from comparison entirely. */
const MIN_AVG_WORD_LENGTH = 2.5;

/** Keep only 1 in 4 shingles (selected by hash, so the same phrase is always
 *  kept or always dropped across documents). This is standard winnowing: it
 *  cuts index memory ~4x while leaving containment estimates accurate to a few
 *  percent, which is far finer than the 40% threshold needs. Without it, a
 *  corpus of several thousand submissions exhausts memory. */
const SHINGLE_SAMPLE_MASK = 3;

/** Max matches stored per submission. */
const MAX_MATCHES = 20;

/** Corpus reads are cached briefly so batch grading doesn't re-read the whole
 *  college once per submission. */
const CORPUS_CACHE_MS = 30_000;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

/** FNV-1a 32-bit. Used only to decide which shingles to sample. */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build the sampled set of word-shingles for a document. Computing this once
 * per submission is what makes comparison affordable.
 */
function buildShingles(text: string): string[] {
  const words = normalize(text).split(" ").filter((w) => w.length > 0);
  if (!isProse(words)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) {
    const shingle = words.slice(i, i + SHINGLE_SIZE).join(" ");
    if (shingle.length < MIN_SHINGLE_CHARS) continue;
    if ((hashString(shingle) & SHINGLE_SAMPLE_MASK) !== 0) continue;
    if (seen.has(shingle)) continue;
    seen.add(shingle);
    out.push(shingle);
  }
  return out;
}

/**
 * Reject character-spaced OCR output. Such documents are all single-letter
 * "words", so they trivially match each other and swamp the results.
 */
function isProse(words: string[]): boolean {
  if (words.length === 0) return false;
  let chars = 0;
  for (const w of words) chars += w.length;
  return chars / words.length >= MIN_AVG_WORD_LENGTH;
}

interface CorpusRow {
  id: string;
  assignmentId: string;
  studentName: string;
  studentId: string;
  studentEmail: string | null;
  content: string;
}

interface Corpus {
  rows: CorpusRow[];
  assignmentTitles: Map<string, string>;
}

let corpusCache: { collegeId: string; corpus: Corpus; expiresAt: number } | null = null;

async function loadCorpus(collegeId: string, forceRefresh = false): Promise<Corpus> {
  const now = Date.now();
  if (!forceRefresh && corpusCache && corpusCache.collegeId === collegeId && corpusCache.expiresAt > now) {
    return corpusCache.corpus;
  }

  const [rows, collegeAssignments] = await Promise.all([
    storage.getAllSubmissionsWithContentByCollege(collegeId),
    storage.getAssignmentsByCollege(collegeId),
  ]);

  const corpus: Corpus = {
    rows: rows.filter(
      (r: any) =>
        r.content &&
        r.content.trim().length >= MIN_CONTENT_LENGTH &&
        !isPlaceholderContent(r.content)
    ) as CorpusRow[],
    assignmentTitles: new Map(collegeAssignments.map((a) => [a.id, a.title])),
  };

  corpusCache = { collegeId, corpus, expiresAt: now + CORPUS_CACHE_MS };
  return corpus;
}

function toMatch(
  row: CorpusRow,
  assignmentTitles: Map<string, string>,
  similarityPercentage: number,
  matchedPhrases: string[]
): CrossSimilarSubmission {
  return {
    submissionId: row.id,
    studentName: row.studentName,
    studentId: row.studentId,
    studentEmail: row.studentEmail ?? null,
    assignmentId: row.assignmentId,
    assignmentTitle: assignmentTitles.get(row.assignmentId) || "Unknown assignment",
    similarityPercentage,
    matchedPhrases,
  };
}

/**
 * Run after a single submission is graded. Streams the corpus one document at
 * a time so memory stays flat regardless of corpus size. Fires async — never
 * blocks the grading response.
 */
export async function checkCrossAssignmentSimilarity(
  submissionId: string,
  collegeId: string
): Promise<void> {
  try {
    let { rows, assignmentTitles } = await loadCorpus(collegeId);
    let target = rows.find((r) => r.id === submissionId);

    // A submission graded moments ago may postdate the cached corpus. Reload
    // once before concluding there is nothing to compare.
    if (!target) {
      ({ rows, assignmentTitles } = await loadCorpus(collegeId, true));
      target = rows.find((r) => r.id === submissionId);
    }
    if (!target) return;

    const targetShingles = buildShingles(target.content);
    if (targetShingles.length === 0) return;
    const targetSet = new Set(targetShingles);

    const matches: CrossSimilarSubmission[] = [];
    let maxScore = 0;

    for (const other of rows) {
      if (other.id === target.id) continue;
      // Same-assignment overlap is already covered by the plagiarism check.
      if (other.assignmentId === target.assignmentId) continue;
      // A student reusing their OWN work across assignments is expected, not
      // misconduct. Only flag content shared with a different student.
      if (other.studentId === target.studentId) continue;

      const otherShingles = buildShingles(other.content);
      if (otherShingles.length === 0) continue;

      const phrases: string[] = [];
      let overlap = 0;
      for (const shingle of otherShingles) {
        if (!targetSet.has(shingle)) continue;
        overlap++;
        if (phrases.length < 5) phrases.push(shingle);
      }

      const similarity = Math.round((overlap / targetShingles.length) * 100);
      if (similarity < SIMILARITY_THRESHOLD) continue;

      matches.push(toMatch(other, assignmentTitles, similarity, phrases));
      if (similarity > maxScore) maxScore = similarity;
    }

    matches.sort((a, b) => b.similarityPercentage - a.similarityPercentage);

    await storage.saveCrossAssignmentFlag({
      submissionId,
      collegeId,
      similarSubmissions: matches.slice(0, MAX_MATCHES),
      maxSimilarityScore: maxScore,
    });

    if (matches.length > 0) {
      console.log(
        `[CrossSimilarity] Submission ${submissionId}: ${matches.length} cross-assignment matches (max ${maxScore}%)`
      );
    }
  } catch (err) {
    console.error("[CrossSimilarity] Error checking cross-assignment similarity:", err);
  }
}

// ---------------------------------------------------------------------------
// Full-corpus backfill
// ---------------------------------------------------------------------------

interface BackfillProgress {
  running: boolean;
  total: number;
  processed: number;
  flagged: number;
  startedAt: number;
  error?: string;
}

const progressByCollege = new Map<string, BackfillProgress>();

export function getBackfillProgress(collegeId: string): BackfillProgress | null {
  return progressByCollege.get(collegeId) ?? null;
}

export function isBackfillRunning(collegeId: string): boolean {
  return progressByCollege.get(collegeId)?.running === true;
}

/**
 * Scan every submission in the college in ONE pass.
 *
 * Uses an inverted index (phrase -> documents containing it) rather than
 * comparing every pair. With several thousand submissions a brute-force
 * pairwise scan is tens of millions of comparisons; the index only ever
 * touches pairs that genuinely share a phrase, which is a tiny fraction.
 */
export async function runCrossSimilarityBackfill(
  collegeId: string
): Promise<{ checked: number; flagged: number }> {
  if (isBackfillRunning(collegeId)) {
    return { checked: 0, flagged: 0 };
  }

  const progress: BackfillProgress = {
    running: true,
    total: 0,
    processed: 0,
    flagged: 0,
    startedAt: Date.now(),
  };
  progressByCollege.set(collegeId, progress);

  try {
    const { rows, assignmentTitles } = await loadCorpus(collegeId);
    progress.total = rows.length;

    console.log(
      `[CrossSimilarity] Backfill starting for college ${collegeId}: ${rows.length} submissions with usable content`
    );

    // --- Pass 1: shingle every document and build the inverted index --------
    const docShingles: string[][] = new Array(rows.length);
    const index = new Map<string, number[]>();

    for (let i = 0; i < rows.length; i++) {
      const shingles = buildShingles(rows[i].content);
      docShingles[i] = shingles;
      for (const shingle of shingles) {
        let postings = index.get(shingle);
        if (!postings) {
          postings = [];
          index.set(shingle, postings);
        }
        postings.push(i);
      }
      if (i % 100 === 0) await new Promise((r) => setImmediate(r));
    }

    // NOTE: no document-frequency pruning here. Dropping "boilerplate" phrases
    // from the index would remove them from the backfill's overlap count while
    // the incremental path still counts them, so the same pair would score
    // differently depending on which path produced the flag. Measured pruning
    // benefit was negligible; identical scoring across both paths is worth more.
    console.log(`[CrossSimilarity] Index built: ${index.size} distinct phrases`);

    // --- Pass 2: score each document against its index candidates -----------
    const flagsToSave: {
      submissionId: string;
      collegeId: string;
      similarSubmissions: CrossSimilarSubmission[];
      maxSimilarityScore: number;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const shingles = docShingles[i];
      progress.processed = i + 1;

      if (shingles.length === 0) {
        if (i % 50 === 0) await new Promise((r) => setImmediate(r));
        continue;
      }

      const overlapCounts = new Map<number, number>();
      const phrasesByDoc = new Map<number, string[]>();

      for (const shingle of shingles) {
        const postings = index.get(shingle);
        if (!postings) continue;
        for (const j of postings) {
          if (j === i) continue;
          if (rows[j].assignmentId === rows[i].assignmentId) continue;
          if (rows[j].studentId === rows[i].studentId) continue;
          overlapCounts.set(j, (overlapCounts.get(j) ?? 0) + 1);
          let phrases = phrasesByDoc.get(j);
          if (!phrases) {
            phrases = [];
            phrasesByDoc.set(j, phrases);
          }
          if (phrases.length < 5) phrases.push(shingle);
        }
      }

      const matches: CrossSimilarSubmission[] = [];
      let maxScore = 0;

      for (const [j, overlap] of Array.from(overlapCounts.entries())) {
        const similarity = Math.round((overlap / shingles.length) * 100);
        if (similarity < SIMILARITY_THRESHOLD) continue;
        matches.push(
          toMatch(rows[j], assignmentTitles, similarity, phrasesByDoc.get(j) ?? [])
        );
        if (similarity > maxScore) maxScore = similarity;
      }

      if (matches.length > 0) {
        matches.sort((a, b) => b.similarityPercentage - a.similarityPercentage);
        progress.flagged++;
        flagsToSave.push({
          submissionId: rows[i].id,
          collegeId,
          similarSubmissions: matches.slice(0, MAX_MATCHES),
          maxSimilarityScore: maxScore,
        });
      }

      if (i % 50 === 0) await new Promise((r) => setImmediate(r));
    }

    // --- Persist: one bulk replace instead of thousands of round trips ------
    await storage.replaceCrossAssignmentFlagsForCollege(collegeId, flagsToSave);

    console.log(
      `[CrossSimilarity] Backfill complete for college ${collegeId}: ${rows.length} checked, ${flagsToSave.length} flagged`
    );
    return { checked: rows.length, flagged: flagsToSave.length };
  } catch (err) {
    progress.error = (err as Error).message;
    console.error("[CrossSimilarity] Backfill failed:", err);
    throw err;
  } finally {
    progress.running = false;
  }
}
