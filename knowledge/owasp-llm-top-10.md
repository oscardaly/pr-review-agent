# OWASP Top 10 for LLM Applications (2025) — Code Review Cues

What each category looks like in a TypeScript diff that builds on LLMs. Categories map to https://genai.owasp.org/llm-top-10/.

## LLM01 Prompt Injection

User-controlled text concatenated into a system prompt or agent instructions; retrieved documents, tool results, or scraped web content inserted into prompts without delimiting or trust labelling; "ignore previous instructions" reaching the model with the same authority as the developer's prompt. Review cue: every string entering a prompt should be traceable to a trust level, and untrusted content must be clearly fenced and never able to redefine the agent's role or tools.

## LLM02 Sensitive Information Disclosure

Secrets, credentials, or PII included in prompts, few-shot examples, or fine-tuning data; model responses echoed to users or logs without filtering; error handlers that attach raw prompts (containing user data) to telemetry. Review cue: redact before the model sees it — anything in a prompt should be assumed to appear in a trace, a log, or another user's completion.

## LLM03 Supply Chain

Unpinned model identifiers or provider SDKs; downloading model weights, adapters, or embeddings from unverified sources; third-party prompts, agent definitions, or MCP servers vendored without review. Review cue: treat models, prompts, and skills like dependencies — pinned, reviewed, and from sources you trust.

## LLM04 Data and Model Poisoning

Training or fine-tuning pipelines that ingest user-submitted content without validation; feedback loops where model output (or user reactions to it) is written back into knowledge bases or few-shot stores automatically. Review cue: any write path into training data, RAG corpora, or learned lessons needs a human gate or validation step — an attacker who can write to your knowledge base owns your future outputs.

## LLM05 Improper Output Handling

Model output passed to `eval`, `child_process`, SQL, or `dangerouslySetInnerHTML`; generated code executed without sandboxing; structured output consumed without schema validation (`JSON.parse` straight into trusted types). Review cue: model output is untrusted input — validate it with a schema and treat it with exactly the suspicion you'd give a request body.

## LLM06 Excessive Agency

Agents granted tools broader than the task needs (shell access where one API call would do); tool calls with irreversible effects (payments, deletes, sends) executed without confirmation or scoping; agent identity carrying admin permissions. Review cue: for every new tool, ask what the worst prompt-injected call could do — permissions belong to the task, not the agent.

## LLM07 System Prompt Leakage

Secrets, API keys, or internal rules embedded in system prompts on the assumption users can't see them; authorization decisions made inside the prompt rather than in code. Review cue: system prompts are configuration, not a vault — anything security-critical in a prompt must also be enforced outside the model.

## LLM08 Vector and Embedding Weaknesses

Multi-tenant vector stores queried without tenant filtering; documents embedded with no provenance metadata, making poisoned entries impossible to trace or evict; retrieval results trusted as authoritative because they came from "our" knowledge base. Review cue: retrieval is a query over user-influenceable data — scope it, attribute it, and treat what comes back as content, not instructions.

## LLM09 Misinformation

Model-generated facts, citations, or code presented to users without verification paths; fabricated URLs or references rendered as links; confidence language added to uncertain output. Review cue: diffs that surface model claims directly to users should show where a human can verify — cite only real, allowlisted sources and label generated content as generated.

## LLM10 Unbounded Consumption

Model calls in loops without iteration caps or budgets; user input controlling retry counts, context sizes, or fan-out width; missing rate limits on endpoints that trigger expensive completions; streaming endpoints without timeouts. Review cue: every model call path needs a ceiling — an attacker who controls how often or how large you prompt controls your bill and your availability.
