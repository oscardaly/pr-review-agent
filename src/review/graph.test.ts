import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BaseMessage } from "@langchain/core/messages";

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
    match: "the tests reviewer",
    response: {
      comments: [
        {
          file: "src/lib/exportHelpers.ts",
          line: 1,
          severity: "warning",
          category: "missing-tests",
          title: "fmt's 500-row truncation has no test",
          body: "The truncation branch is new logic with no test touched in this PR.",
          takeaway: "New branching logic ships with a test for its boundary.",
          citations: [],
          guideline: "Tests are first-class code",
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
  {
    match: "fmt's 500-row truncation has no test",
    response: { verdict: "drop", confidence: 0.8, reasoning: "fixture code" },
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

    expect(finalState.draftComments).toHaveLength(4);
    expect(
      finalState.validatedComments.map((comment) => comment.title),
    ).toEqual(["SQL injection via template literal"]);
    expect(finalState.droppedComments).toHaveLength(3);
    expect(finalState.docsImpact?.needsUpdate).toBe(true);
    expect(finalState.redactions).toHaveLength(2);
    expect(finalState.rawDiff).toBe("");

    const reviewMarkdown = readFileSync(finalState.reviewUrl!, "utf-8");
    expect(reviewMarkdown).toContain("Request changes");
    expect(reviewMarkdown).toContain("SQL injection via template literal");
    expect(reviewMarkdown).toContain(
      "Takeaway:** User input may only reach an interpreter through a parameterized API.",
    );
    expect(reviewMarkdown).toContain("3 draft(s) dropped by the validator");
    expect(reviewMarkdown).toContain("2 secret/PII value(s) redacted");
    expect(reviewMarkdown).toContain("cli-usage.md");
    expect(existsSync(join(outputPath, "pr-42", "comments.json"))).toBe(true);
  });

  test("a reviewer that fails outright is skipped instead of failing the review", async () => {
    const outputPath = mkdtempSync(join(tmpdir(), "pr-review-degraded-"));
    class FailingStyleModel extends ScriptedChatModel {
      override async _generate(messages: BaseMessage[]) {
        const promptText = messages
          .map((message) => String(message.content))
          .join("\n");
        if (promptText.includes("the code style reviewer")) {
          throw Object.assign(new Error("provider rejected the key"), {
            status: 401,
          });
        }
        return super._generate(messages);
      }
    }
    const config = { ...loadConfig(), outputPath };
    const graph = buildReviewGraph({
      model: new FailingStyleModel(
        REVIEWER_SCRIPT.filter((rule) => rule.match !== "the code style reviewer"),
      ),
      knowledgeBase: await loadKnowledgeBase(
        config.knowledgePath,
        new HashEmbeddings(),
      ),
      github: createFileSystemGithubClient(outputPath),
      semgrepScanner: scanWithBuiltinRules,
      config,
    });

    const finalState = await graph.invoke({
      rawDiff: SAMPLE_DIFF,
      metadata: SAMPLE_METADATA,
    });

    expect(finalState.draftComments).toHaveLength(3); // style reviewer degraded to zero comments
    expect(
      finalState.validatedComments.map((comment) => comment.title),
    ).toEqual(["SQL injection via template literal"]);
    expect(finalState.reviewUrl).toBeDefined();
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
