---
name: Verifying against real corpus size
description: This project's real corpus is thousands of submissions; matching/perf logic must be validated against it, not against a small college.
---

Submissions are heavily skewed toward one college. Another college holds only a handful of
records, so a scan pointed at it completes instantly and proves nothing.

**Why:** A full-corpus scan was once validated against the 3-submission college and looked
perfect. Against the real corpus it exposed both a performance cliff and several
false-positive classes that were invisible at small scale.

**How to apply:** Before declaring matching, scoring, or bulk-processing work finished,
run it against the largest college and report three numbers: elapsed time, peak heap, and
the flag/match rate. A flag rate far above a few percent is a false-positive smell — sample
the actual matched phrases and read them, rather than trusting the count.
