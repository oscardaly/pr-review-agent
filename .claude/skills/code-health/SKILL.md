---
name: code-health
description: >
  Audit this repo's health across four dimensions — conventions, test
  coverage, dependency hygiene, and knowledge-base integrity — and produce
  a severity-ranked report with recommendations.
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Code Health Audit

Audit the repo against its own standards. Read `CLAUDE.md` first — its Conventions and Testing sections define what "healthy" means here.

## Dimensions

### 1. Convention compliance

- **File size**: list `.ts` files in `src/` over 100 lines (excluding tests).
- **Function size**: sample the largest files for functions over ~15 lines.
- **Naming**: grep recently changed files for abbreviated identifiers (`p`, `img`, `res`, `err`) and noise words in type names.
- **Type safety**: count `any`, `as` casts, and `@ts-ignore`/`@ts-expect-error` occurrences.
- **Dead code**: exported symbols never imported elsewhere.
- **Persona discipline**: grep for hardcoded "Leo" strings outside `src/persona.ts` — persona text must come from that module.

### 2. Test coverage

- Map each `src/**/*.ts` production file to its `.test.ts` neighbour; report the uncovered list.
- Confirm the suite passes offline: `bun test` with no `.env` — any test needing a key or network is a regression.
- Spot-check 3 test files for Arrange-Act-Assert structure and one-concept-per-test.

### 3. Dependency hygiene

- `package.json` must pin exact versions — flag any `^`/`~` ranges.
- Run `bun outdated` and summarise; note any major-version LangChain/LangGraph drift (this repo pins deliberately).
- Flag dependencies in `package.json` never imported in `src/`.

### 4. Knowledge-base integrity

- Every `knowledge/*.md` guideline file must be registered in `TOPIC_BY_FILENAME` (`src/rag/knowledge-base.ts`) — orphaned files silently never reach reviewers.
- Every file in `knowledge/skills/` must be loaded in `loadKnowledgeBase` — same failure mode.
- Chunking contract: each rule in `knowledge/*.md` is one `##` section; flag sections over ~150 words (they retrieve poorly) or files with prose outside any section.
- `knowledge/doc-links.json` URLs: spot-check topics referenced by reviewers exist in the file.

## Report

Write to `docs/code-health/YYYY-MM-DD.md` (create the directory if needed). Severity per finding: **Critical** (broken behaviour, silent knowledge loss) / **High** (missing tests on core paths, convention violation with blast radius) / **Medium** / **Low**. Score each dimension out of 10 (start at 10; −3 Critical, −2 High, −1 Medium, −0.5 Low; floor 0), then average for the overall score. If a previous report exists in the directory, include a trend line against it.

End with the top 3 recommendations, each with an effort estimate (small/medium/large). Print the overall score, finding counts by severity, and the report path.
