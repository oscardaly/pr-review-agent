import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../config";
import { HashEmbeddings } from "../rag/hash-embeddings";
import { loadKnowledgeBase } from "../rag/knowledge-base";
import {
  ScriptedChatModel,
  type ScriptRule,
} from "../testing/scripted-chat-model";
import { createFileSystemGithubClient } from "../tools/github";
import { scanWithBuiltinRules } from "../tools/semgrep";
import { buildReviewGraph } from "./graph";

const SAMPLE_DIFF = readFileSync(
  new URL("../../fixtures/sample-pr.diff", import.meta.url),
  "utf-8",
);
const SAMPLE_METADATA = JSON.parse(
  readFileSync(
    new URL("../../fixtures/sample-pr.json", import.meta.url),
    "utf-8",
  ),
);

const REVIEWER_SCRIPT: ScriptRule[] = [
  {
    match: "the code style reviewer",
    response: {
      comments: [
        {
          file: "src/lib/exportHelpers.ts",
          line: 1,
          severity: "warning",
          category: "naming",
          title: "Rename fmt and its parameters",
          body: "Single-letter names hide intent.",
          takeaway: "Name things after what they mean, not what they are.",
          citations: [],
          guideline: "Descriptive names everywhere",
        },
      ],
    },
  },
  {
    match: "the architecture reviewer",
    response: {
      comments: [
        {
          file: "src/app/api/export/route.ts",
          line: 3,
          severity: "warning",
          category: "external-deps",
          title: "Wrap the sendgrid SDK behind a service",
          body: "Third-party SDKs must be wrapped.",
          takeaway: "Own the interface, rent the implementation.",
          citations: [],
          guideline: "Wrap external dependencies",
        },
      ],
    },
  },
  {
    match: "the security reviewer",
    response: {
      comments: [
        {
          file: "src/app/api/export/route.ts",
          line: 15,
          severity: "critical",
          category: "injection",
          title: "SQL injection via template literal",
          body: "customerId flows into the query unparameterized.",
          takeaway:
            "User input may only reach an interpreter through a parameterized API.",
          citations: [
            { title: "OWASP Top 10", url: "https://owasp.org/Top10/" },
          ],
          guideline: "A03 Injection",
        },
      ],
    },
  },
  {
    match: "user-facing documentation stale",
    response: {
      needsUpdate: true,
      items: [
        {
          document: "cli-usage.md",
          reason: "--verbose was renamed to --log-level",
          suggestedUpdate: "Document the new --log-level values.",
        },
      ],
    },
  },
  {
    match: "SQL injection via template literal",
    response: { verdict: "keep", confidence: 0.95, reasoning: "real" },
  },
  {
    match: "Wrap the sendgrid SDK behind a service",
    response: { verdict: "keep", confidence: 0.5, reasoning: "unsure" },
  },
  {
    match: "Rename fmt and its parameters",
    response: { verdict: "drop", confidence: 0.9, reasoning: "nitpick" },
  },
];

const buildTestGraph = (rules: ScriptRule[], outputPath: string) => {
  const config = { ...loadConfig(), outputPath };
  return (async () =>
    buildReviewGraph({
      model: new ScriptedChatModel(rules),
      knowledgeBase: await loadKnowledgeBase(
        config.knowledgePath,
        new HashEmbeddings(),
      ),
      github: createFileSystemGithubClient(outputPath),
      semgrepScanner: scanWithBuiltinRules,
      config,
    }))();
};

describe("review graph", () => {
  test("runs end-to-end: reviewers fan out, validator filters, publisher writes the review", async () => {
    const outputPath = mkdtempSync(join(tmpdir(), "pr-review-test-"));
    const graph = await buildTestGraph(REVIEWER_SCRIPT, outputPath);

    const finalState = await graph.invoke({
      rawDiff: SAMPLE_DIFF,
      metadata: SAMPLE_METADATA,
    });

    expect(finalState.draftComments).toHaveLength(3);
    expect(
      finalState.validatedComments.map((comment) => comment.title),
    ).toEqual(["SQL injection via template literal"]);
    expect(finalState.droppedComments).toHaveLength(2);
    expect(finalState.docsImpact?.needsUpdate).toBe(true);
    expect(finalState.redactions).toHaveLength(2);
    expect(finalState.rawDiff).toBe("");

    const reviewMarkdown = readFileSync(finalState.reviewUrl!, "utf-8");
    expect(reviewMarkdown).toContain("Request changes");
    expect(reviewMarkdown).toContain("SQL injection via template literal");
    expect(reviewMarkdown).toContain(
      "Takeaway:** User input may only reach an interpreter through a parameterized API.",
    );
    expect(reviewMarkdown).toContain("2 draft(s) dropped by the validator");
    expect(reviewMarkdown).toContain("2 secret/PII value(s) redacted");
    expect(reviewMarkdown).toContain("cli-usage.md");
    expect(existsSync(join(outputPath, "pr-42", "comments.json"))).toBe(true);
  });

  test("skips the reviewers entirely when the diff has nothing reviewable", async () => {
    const outputPath = mkdtempSync(join(tmpdir(), "pr-review-empty-"));
    const graph = await buildTestGraph([], outputPath); // any model call would throw

    const finalState = await graph.invoke({
      rawDiff: "",
      metadata: { ...SAMPLE_METADATA, number: 7 },
    });

    expect(finalState.validatedComments).toEqual([]);
    const reviewMarkdown = readFileSync(finalState.reviewUrl!, "utf-8");
    expect(reviewMarkdown).toContain("Looks good");
  });
});
