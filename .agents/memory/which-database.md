---
name: Which database the app actually uses
description: The app connects via DATABASE_URL; a separate unused NEON_DATABASE_URL secret exists and returns misleading results.
---

The server connects using `DATABASE_URL`. A separate `NEON_DATABASE_URL` secret is also
present in the environment but is **not** what the application uses.

**Why:** Diagnostic queries run with `NEON_DATABASE_URL` reported an empty results table
and a different submission count than the app saw. This produced two wrong diagnoses in a
row — a feature was declared "not saving anything" when it was in fact writing correctly
to the real database.

**How to apply:** When verifying data the app wrote, query through the app's own
storage/db layer (e.g. a `tsx` script importing `server/storage`), not a hand-rolled `pg`
Pool built from whichever connection-string secret happens to be present. If you must use
raw SQL, read the connection string from the same variable `server/db.ts` uses.
