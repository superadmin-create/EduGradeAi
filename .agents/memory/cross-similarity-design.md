---
name: Cross-assignment similarity design
description: Scoring model and the content filters that keep cross-assignment reuse detection from drowning in false positives.
---

Detects a submission reusing content from a *different* assignment. Same-assignment
overlap is already covered by the separate plagiarism check.

## Scoring
Similarity is **containment** — shared phrases divided by the *target's* phrase count —
not a symmetric measure like Jaccard. **Why:** the grader's question is "how much of THIS
submission is reused from elsewhere," which is inherently directional; a short submission
copied wholesale into a long one should still score high for the short one.

Threshold is **40%**, deliberately higher than the same-assignment plagiarism threshold.
**Why:** submissions responding to the same prompt naturally share vocabulary.

## Filters that matter (each was added after observing real false positives)
- **Same student excluded.** A student resubmitting their own resume/work to a second
  assignment is legitimate. **Why:** this alone accounted for ~38% of all flags.
- **Character-spaced OCR text excluded** (average word length below ~2.5). **Why:** some
  extracted text arrives as `F o r m a t`, making every letter a "word"; 5-word shingles
  become 5 letters and any two such documents match at ~100%.
- **Processing-failure placeholders excluded.** Some rows store an error notice instead of
  work. **Why:** they are byte-identical to each other and all match at 100%.
- **Boilerplate phrases pruned** when they appear in more than ~10% of the corpus.

**How to apply:** Any new match-quality complaint should first be checked against these
four classes before the threshold is touched. Lowering or raising the threshold does not
fix a degenerate-content problem.

## Performance constraint
Brute-force pairwise comparison is not viable at this corpus size. The full scan builds an
inverted index (phrase to documents) and only ever touches pairs that genuinely share a
phrase; phrases are sampled 1-in-4 by hash so the same phrase is kept or dropped
consistently across documents, which keeps containment estimates accurate while cutting
index memory roughly fourfold.

**Why:** an earlier substring/LCS implementation ran nested loops per pair and had to be
abandoned after it saturated the server and the database terminated the connection.
