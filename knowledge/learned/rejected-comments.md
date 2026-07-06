# Learned: Rejected Comments

Comments the team rejected, recorded by the feedback loop (`bun run feedback`). The
comment validator reads this file and must not approve new comments that repeat
these mistakes. Each entry is appended automatically — treat this file as
agent-owned memory, reviewed by humans via the improvement PRs that add to it.

## Lesson: single-letter names are fine in tiny lambdas the team considers idiomatic

- **Rejected comment:** "Rename `x` in `[1, 2, 3].map((x) => x * 2)` to a descriptive name."
- **Human reply:** "You're wrong — a one-character parameter in a one-expression numeric lambda is idiomatic here; the naming rule targets business logic, not arithmetic."
- **Rule of thumb going forward:** apply the descriptive-naming guideline to domain values (products, sessions, prices), not to throwaway parameters in one-line numeric/utility lambdas.
