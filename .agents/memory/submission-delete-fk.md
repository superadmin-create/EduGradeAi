---
name: Submission delete must clear all dependent tables
description: Deleting a submission failed with a 500 because only grading_results was cleared before deleting the submission row.
---

`submissions` is referenced by a non-cascading FK from multiple tables: `grading_results`, `plagiarism_results`, and `cross_assignment_flags`. Deleting a submission without first deleting its rows in *all* of these throws a foreign-key violation.

**Why:** the original `deleteSubmission` only cleared `grading_results` before deleting the submission. Any submission with a plagiarism check or a cross-assignment-similarity flag against it failed to delete with a 500, and the partial delete (grading_results gone, submission still present) left orphaned state.

**How to apply:** if a new feature adds another table with a `submissionId` FK (no `onDelete: cascade`), add its cleanup to `deleteSubmission` in `server/storage.ts` at the same time. Prefer `onDelete: "cascade"` on new FKs to this table going forward so this class of bug can't recur.

All deletion entry points must preserve the same cleanup guarantees, including deleting an assignment with submissions. Multi-record deletion should be atomic.

**Why:** fixing individual submission deletion did not fix assignment deletion; the separate cleanup path could still remove grades and then fail, leaving the assignment and submissions without their grades.

**How to apply:** when changing deletion behavior, check parent-level and individual deletion together. Use a transaction so failed cleanup retains the original records rather than partially deleting them.
