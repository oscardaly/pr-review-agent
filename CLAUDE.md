# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Leo — a PR review agent built with LangGraph (state & control flow), LangChain (models, tools, RAG), and LangSmith (tracing & evals). It parses a diff, redacts secrets/PII, fans out to four parallel reviewers (style, architecture, security, docs), cross-examines every draft comment with a validator subagent, and publishes a teaching-oriented review. A second graph learns from rejected comments by proposing PRs against its own knowledge base.

## Commands

```bash
bun install                  # Install dependencies
bun test                     # Full offline test suite (scripted model, no API key needed)
bun test src/rag             # Run one directory's tests
bunx tsc --noEmit            # Typecheck
make demo                    # Review the bundled sample PR (needs an API key in .env)
make feedback                # Process the bundled "you're wrong" reply
make eval                    # Run the eval dataset (LangSmith experiment, or local table)
bun src/cli.ts bootstrap --repo <path>   # Draft guideline docs from a target repo
```

## Architecture

- `src/review/` — the review graph: `state.ts` (annotations + reducers), `graph.ts` (edges), `nodes/` (ingest → reviewers → validate → publish). Reviewers run in parallel in one superstep, appending to `draftComments` via a concat reducer — the only shared-state merge in the graph.
- `src/feedback/` — the self-improvement graph (classify reply → record lesson → open improvement PR).
- `src/rag/` — knowledge base: markdown chunked on `##` headings (one chunk = one complete rule), topic-filtered cosine similarity, hashed bag-of-words embeddings as the offline fallback.
- `src/tools/` — the semgrep scanner (LangChain `tool()`, so scans appear as traced tool runs) and the filesystem-backed, Octokit-shaped GitHub client stub.
- `src/diff/` — unified-diff parser, secret/PII redaction, prompt formatting.
- `src/persona.ts` — Leo's name, sign-off, and voice rules, defined once. Prompts, rendered reviews, and the CLI all read from here; never inline persona text elsewhere.
- `src/wiring.ts` — the only place real implementations are chosen. The graph takes `{ model, knowledgeBase, github, semgrepScanner, config }` at build time; everything is injected.
- `knowledge/` — the guideline docs (RAG source), `skills/` (dispositions injected whole into prompts: ponytail for suggestion code, review-critic for validation), `learned/` (lessons from rejected comments).

### Load-bearing design rules

- **Dependency injection everywhere.** New nodes take dependencies through `ReviewGraphDependencies`, never import concrete implementations. This is what lets integration tests run the entire graph with a scripted model.
- **Skills are markdown, not TypeScript.** A disposition that should be active on every response (how to write suggestion code, how to judge a draft) lives in `knowledge/skills/*.md` and is injected whole — retrieval would defeat its contract. Rules that are looked up per-diff live in `knowledge/*.md` and go through RAG.
- **The raw diff is cleared from state after redaction.** Every node downstream of ingest (and every trace) sees only the redacted view. Don't reintroduce the raw diff anywhere.
- **Structured output goes through `invokeStructured`** (prompt + Zod parse with one retry). Provider-native tool calling would be swapped in behind that same signature.

## Conventions

- **Functions**: arrow functions (`const fn = () =>`); each does one thing, ~10 lines, extract named helpers past ~15. Max three arguments — group more into an options object and destructure in the signature. No flag/boolean arguments — split the function instead.
- **Naming**: descriptive names everywhere, including callback parameters — `comment`, not `c`; `filename`, not `f`. One word per concept across the codebase. Method names are verbs, type names are nouns, no noise words (`Data`, `Info`, `Manager`).
- **Files**: ~100 lines; split larger files into focused modules. Types can live in a separate `types.ts`.
- **Errors**: exceptions over error codes or null returns; every error names the operation and the failure. Don't return or pass null — use empty arrays or explicit optionals.
- **Comments**: explain *why*, never *what*. If a comment restates the code, rename the function instead. No commented-out code — git remembers.
- **Dependencies**: pin exact versions in `package.json` — no `^` or `~`. Wrap third-party libraries behind an interface (see `SemgrepScanner`, `GithubClient`, `KnowledgeBase`).

## Testing

- `bun:test`, files as `src/**/*.test.ts` next to what they test. The whole suite runs offline: the scripted chat model (`src/testing/scripted-chat-model.ts`) routes canned responses by prompt content — order-independent so parallel nodes don't flake — and RAG runs on deterministic hash embeddings.
- Test the public interface, not internals: integration tests drive the compiled graph end-to-end. A test should still pass if the implementation were rewritten.
- F.I.R.S.T.: fast, independent (each test builds its own state), repeatable (no network in tests), self-validating, timely.
- Never mark work complete without proof — run `bun test` and `bunx tsc --noEmit`, and show the result.

## Maintaining CLAUDE.md

When the user gives instructions about project conventions, coding standards, or architectural decisions, update this file to capture them. Only add information that is durable and project-wide — not ephemeral task details.
