import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../config";
import { ScriptedChatModel } from "../testing/scripted-chat-model";
import { createFileSystemGithubClient } from "../tools/github";
import { buildFeedbackGraph } from "./graph";
import type { FeedbackInput } from "./types";

const FEEDBACK_INPUT = JSON.parse(
  readFileSync(
    new URL("../../fixtures/sample-reply.json", import.meta.url),
    "utf-8",
  ),
) as FeedbackInput;

const buildTestGraph = (classification: object, outputPath: string) =>
  buildFeedbackGraph({
    model: new ScriptedChatModel([
      { match: "Classify the reply", response: classification },
    ]),
    github: createFileSystemGithubClient(outputPath),
    knowledgePath: loadConfig().knowledgePath,
  });

describe("feedback graph", () => {
  test("a rejection records the lesson and proposes a PR against the knowledge base", async () => {
    const outputPath = mkdtempSync(join(tmpdir(), "pr-feedback-test-"));
    const graph = buildTestGraph(
      {
        type: "rejection",
        title: "perf-sensitive-loops",
        lesson:
          "Do not suggest declarative array transforms inside documented hot paths.",
      },
      outputPath,
    );

    const finalState = await graph.invoke(FEEDBACK_INPUT);

    expect(finalState.classification?.type).toBe("rejection");
    expect(finalState.improvementPrUrl).toBeDefined();

    const proposedLessons = readFileSync(
      join(
        outputPath,
        "improvement-prs",
        "agent/lesson-perf-sensitive-loops",
        "knowledge__learned__rejected-comments.md",
      ),
      "utf-8",
    );
    expect(proposedLessons).toContain("## Lesson: perf-sensitive-loops");
    expect(proposedLessons).toContain(
      "## Lesson: single-letter names are fine",
    ); // existing lessons preserved
  });

  test("an agreement ends the graph without opening a PR", async () => {
    const outputPath = mkdtempSync(join(tmpdir(), "pr-feedback-agree-"));
    const graph = buildTestGraph(
      { type: "agreement", title: "ack", lesson: "" },
      outputPath,
    );

    const finalState = await graph.invoke(FEEDBACK_INPUT);

    expect(finalState.classification?.type).toBe("agreement");
    expect(finalState.improvementPrUrl).toBeUndefined();
  });
});
