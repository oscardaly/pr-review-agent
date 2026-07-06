---
name: review-pr
description: >
  Dogfood Leo on the current branch: build a diff against main, run the
  review graph over it, and present Leo's published review. Use to sanity
  check prompt or graph changes against a real diff.
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
---

# Review PR (dogfood Leo)

Run this repo's own review agent over the current branch's changes. This is the fastest way to see the end-to-end effect of a prompt, persona, knowledge-base, or graph change.

## Steps

### 1. Check preconditions

- The branch must differ from `main` (`git diff main...HEAD --stat`). If there are no changes, tell the user and stop.
- An API key must be present in `.env` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or AI-Gateway credentials). If not, tell the user Leo needs one to run live and stop — `bun test` covers the offline path.

### 2. Build the review inputs

Write both files to a scratch directory, not the repo:

1. The diff: `git diff main...HEAD > <scratch>/branch.diff`
2. Metadata JSON matching `PullRequestMetadata` (all five fields required):

```json
{
  "number": 0,
  "title": "<current branch name>",
  "description": "<one-line summary of the branch's commits>",
  "author": "<git config user.name>",
  "repository": "oscardaly/pr-review-agent"
}
```

### 3. Run Leo

```bash
bun src/cli.ts review --diff <scratch>/branch.diff --pr <scratch>/metadata.json
```

Stream the node-by-node progress to the user as it runs.

### 4. Present the review

Read the review from `review-output/pr-0/review.md` and show it. Then report:

- Verdict line (request changes / comments / looks good)
- Comments published vs. drafts dropped by the validator
- Redaction count
- If `LANGSMITH_TRACING` is enabled, remind the user the full trace is in LangSmith under run name `pr-review #0`.
