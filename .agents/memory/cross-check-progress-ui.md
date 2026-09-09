---
name: Cross-check scan progress UI
description: Why the full cross-assignment scan finishes far faster than "thousands of submissions" suggests, and what that means for any UI that watches it.
---

The full-corpus cross-assignment scan is fast: a ~3,900-submission college finishes in
roughly two seconds (inverted index, single pass, one bulk write at the end). "Thousands of
submissions" reads like a long job, but it is not.

**How to apply:** any UI or client that watches the scan must assume it can finish *before
the first progress poll returns*. Arm completion detection when the scan is requested, not
when `running: true` is first observed — otherwise a fast scan never reports a result and
the caller waits forever. Live per-item progress is a bonus for the slow case, not the
normal path.

Progress is in-memory per college and is *not* cleared when the scan ends: after a scan the
endpoint keeps returning the last run's counts with `running: false`. **Why it matters:** a
freshly loaded page sees a completed scan it never started, so "not running" alone must
never be treated as "the scan I asked for just finished".

The scan is deterministic — re-running it over unchanged submissions reproduces the same
flag set, so triggering one to verify behaviour is safe.
