# Design notes

The reasoning behind Leo's shape — what was chosen, what was traded away, and why. The short version of each note lives in the [README](README.md#design-notes).

## How state moves

`ingest` parses the raw diff into typed files/hunks with line numbers, redacts secrets and PII in place, then _clears the raw diff from state_ — every later node (and every LangSmith trace of it) works on the redacted view. A conditional edge skips straight to `publish_review` if there's nothing reviewable. The five reviewers run **in parallel** in one superstep, each appending to `draftComments` via a concat reducer — that's the only shared-state merge in the graph, so there's nothing to race. `validate_comments` joins the fan-in (array edge = wait for all), deduplicates, and judges each draft independently; only comments that survive with confidence ≥ threshold reach `publish_review`.

State is defined with LangGraph's `StateSchema` + Zod (the current v1 API), so the channel types are real runtime schemas, not just annotations. If a reviewer dies outright it degrades to zero comments instead of failing the run — the catch lives inside the node because error-handler nodes run under their own name, which would break the fan-in barrier. The non-reviewer nodes carry a `retryPolicy` via `setNodeDefaults`.

## How Leo learns

A rejection gets generalized into a rule of thumb ("don't suggest declarative transforms in documented hot paths"), appended to `knowledge/learned/rejected-comments.md`, and proposed as a PR. The validator reads that file on every review — so a merged lesson immediately changes what the agent will approve. When the original diff is provided, the rejection is also **frozen as an eval regression case** (`knowledge/learned/regression-cases.json`): `make eval` re-reviews that exact diff forever and fails if the rejected comment reappears. Every mistake Leo makes becomes a permanent regression test. Learning is **PR-gated on purpose** — both files ship in the same proposed PR: the agent proposes, humans merge. An agent that silently rewrites its own rules from one grumpy reply is a liability.

When the feedback reply carries the review's run id (printed by the review command), the human verdict is also attached to the original traced run via LangSmith feedback — so you can filter for the reviews that earned rejections.

## Why these six nodes and not one big prompt?

Splitting reviewers by concern gives each one a small, focused context (its own retrieved guidelines, its own doc links), lets them run in parallel, and makes the trace legible — you can see _which_ reviewer produced a bad comment and eval them separately. The validator exists because reviewer nodes are rewarded for finding things; a separate skeptic with the opposite disposition ("drop it unless a senior engineer would act on it") is the cheapest precision lever, and it's also where learned lessons get enforced.

An alternative worth naming: the validator judges each draft inside one node with `Promise.all`; LangGraph's `Send` API could fan each judgement out to its own node instance instead, buying per-judgement retries and trace spans at the cost of more graph machinery. For a handful of drafts per review, the single node is the right size.

## Tool before model

The security reviewer runs semgrep first and hands the findings to the model to triage, not the other way round. Deterministic ground truth anchors the LLM: it can't skim past a flagged `eval()`. The tests reviewer works the same way: a deterministic test-mapping tool reports which changed source files had no test touched in the same PR, and the model judges which of those gaps a senior engineer would actually flag — new branching logic yes, type-only tweaks no. The bundled scanner is a built-in rule set mirroring semgrep rule IDs (the real binary needs full checked-out files, not diffs); `SemgrepScanner` is a one-function interface, so the real CLI is a drop-in swap. One cute trick: redaction placeholders double as detections — `[REDACTED:api-key]` in a diff _is_ the hardcoded-credential finding.

## Teach, don't police

Every comment schema requires a `takeaway` — the transferable rule of thumb, generalised beyond this diff — and the reviewer prompts demand the _why_ (principle + consequence) in the body, never a bare instruction. The validator enforces it: a comment that dictates a change without explaining why, or whose takeaway teaches nothing reusable, gets dropped before publishing. A review that leaves the author better at their next PR is worth ten that just gate this one.

## The persona is a contract, not decoration

Leo's name, sign-off, and voice rules live in one module (`src/persona.ts`) and everything reads from it — reviewer prompts, the rendered review, the CLI — so the character can't drift between surfaces. Crucially, friendliness is _enforced_, not hoped for: the validator (the skeptical staff engineer inside Leo's head) drops drafts whose tone is curt or condescending, the same way it drops drafts that misread the code. And the voice rules end with "friendly never means soft on substance" — severity and evidence stay rigorous; only the delivery is warm.

## Skills are markdown dispositions

Suggested code follows the [ponytail](https://github.com/DietrichGebert/ponytail) skill (MIT, vendored at `knowledge/skills/ponytail.md`). When a reviewer writes fix code in a `suggestion`, it climbs ponytail's ladder — does this need to exist, is it already in the diff, does the stdlib cover it, can it be one line — and never trades away validation, error handling, or security. The skill is injected whole into reviewer prompts (it's a disposition, not a lookup — retrieval would defeat its "active every response" contract) and loads from a plain markdown file, so a team can swap in their own code-writing skill without touching TypeScript.

Two more skills follow the same pattern: `review-critic.md` governs how the validator judges drafts (accuracy first, then false-positive detection, severity calibration, actionability — "three legitimate findings beat fifteen where half are noise"), and `threat-modelling.md` gives the security reviewer a diff-scoped version of [OWASP threat modelling](https://owasp.org/www-community/Threat_Modeling) — the four questions plus STRIDE over each new surface, because guideline chunks pattern-match known-bad code while a threat-model frame catches the clean-looking diff that adds an unguarded trust boundary. Three skills, three dispositions, three consumers — all plain markdown, all swappable without touching TypeScript.

## Reviewing against intent

When the PR references a ticket (a `FLU-123`-shaped identifier in the title or description) and a `LINEAR_API_KEY` is set, ingest resolves it through Linear's hosted MCP server via `@langchain/mcp-adapters` — one config block, not a hand-written Linear client — and reviewers see the ticket alongside the diff, with an explicit brief: if the change contradicts or misses the ticket's stated intent, say so. Three deliberate choices: the fetch lives in ingest (one call, visible in the trace and the CLI output, never five parallel fetches); any failure resolves to `undefined` because a review must never fail because the ticket tracker is down; and the ticket text enters prompts fenced and trust-labelled as data-not-instructions — the exact LLM01 discipline `knowledge/owasp-llm-top-10.md` asks Leo to enforce on other people's diffs. The `TicketClient` seam is one function, so Jira or GitHub Issues are an alternative implementation away, and the same MCP-adapter pattern extends to Sentry or PostHog context (see the improvements list).

## RAG choices

The knowledge base is markdown chunked on `##` headings — each chunk is one complete rule, a semantic boundary a token splitter would cut through. Retrieval is topic-filtered cosine similarity over an in-memory store, exposed via `asRetriever()` so every retrieval is a traced retriever run in LangSmith (LangChain v1 moved the bundled store to the `@langchain/classic` legacy-compat package; ours is ~50 lines against the core `VectorStore` interface instead of taking that dependency). Embeddings are provider-backed when a key exists, and fall back to deterministic hashed bag-of-words so tests, Docker builds, and keyless demos work offline. For a mini KB, keyword-overlap retrieval is honestly fine; the seam to swap in real embeddings (or pgvector) is one factory function — `createEmbeddings` in `src/models.ts`.

## Structured output is layered

Real providers use `withStructuredOutput` — the docs-recommended native path (json_schema mode by default, which OpenAI-compatible gateways support too). Models that never opt in — like the scripted fakes in tests — fall back to prompt + Zod parse with one retry, behind the same `invokeStructured` signature. The opt-in happens where providers are constructed (`src/models.ts`), not via a capability heuristic: test fakes inherit a text-parsing `withStructuredOutput` from the base class that a heuristic would pick up by accident.

## Guardrails

Redaction runs at ingest with conservative patterns (phone matching requires country-code/area-code forms, so numeric literals in code survive). The count is reported in the review header — visible privacy, not silent.

## Everything injected

The graph takes `{ model, knowledgeBase, github, semgrepScanner, config }` at build time; `src/wiring.ts` is the only place real implementations are chosen. That's why the integration tests can run the _entire_ graph — fan-out, reducers, conditional edges, publishing — with a scripted model that routes canned responses by prompt content (order-independent, so parallel nodes don't flake). It's also how the GitHub integration slid in: the REST client implements the same `GithubClient` interface the filesystem stub always had.

## Evals as an instrument, not a ritual

Experiments are stamped with `{ model, commit }` metadata and share an `experimentPrefix`, so LangSmith's comparison view answers "did merging that lesson actually improve precision?" — run the suite before and after and diff the experiments. The dataset syncs idempotently (new regression cases append; nothing is recreated), and `EVAL_LOCAL=1` forces the local score table even when a LangSmith key is set.

## Could we use the AI Gateway and run on Vercel with Docker?

Gateway: yes, today — it's OpenAI-compatible, so `OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1` + `PR_AGENT_MODEL=anthropic/claude-sonnet-4.5` just works (that's why the model factory is `ChatOpenAI` + `baseURL` rather than provider SDKs everywhere). Vercel: the graph fits a webhook-triggered function _if_ you enable fluid compute/long timeouts — a full review is one bounded run, a few minutes worst case. But real semgrep wants a checked-out repo and a binary, which pushes toward the Docker image on Cloud Run/Fly/ECS with a thin webhook in front. I'd start there and keep Vercel for the webhook receiver. A team-facing dashboard (review history, precision trends from the eval experiments, a "lessons Leo has learned" page) would sit naturally in front of this as a Next.js app over a FastAPI or Elysia service wrapping the graph.
