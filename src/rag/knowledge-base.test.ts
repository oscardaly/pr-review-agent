import { describe, expect, test } from "bun:test";

import { loadConfig } from "../config";
import { chunkMarkdownByHeading } from "./chunk-markdown";
import { HashEmbeddings } from "./hash-embeddings";
import { loadKnowledgeBase } from "./knowledge-base";

describe("chunkMarkdownByHeading", () => {
  test("splits on ## headings and records each heading in metadata", () => {
    const markdown =
      "# Title\n\nIntro text.\n\n## Rule one\n\nBody one.\n\n## Rule two\n\nBody two.";

    const chunks = chunkMarkdownByHeading(markdown, { topic: "style" });

    expect(chunks.map((chunk) => chunk.metadata.heading)).toEqual([
      "introduction",
      "Rule one",
      "Rule two",
    ]);
    expect(chunks[1]!.pageContent).toContain("Body one.");
    expect(chunks.every((chunk) => chunk.metadata.topic === "style")).toBe(
      true,
    );
  });
});

describe("loadKnowledgeBase", () => {
  const knowledgePath = loadConfig().knowledgePath;

  test("retrieves security guidance for a security-flavoured query, filtered by topic", async () => {
    const knowledgeBase = await loadKnowledgeBase(
      knowledgePath,
      new HashEmbeddings(),
    );

    const guidelines = await knowledgeBase.retrieveGuidelines(
      ["security"],
      "sql injection eval user input query",
    );

    expect(guidelines.length).toBeGreaterThan(0);
    expect(
      guidelines.every((guideline) => guideline.metadata.topic === "security"),
    ).toBe(true);
    expect(
      guidelines.some((guideline) =>
        guideline.pageContent.toLowerCase().includes("injection"),
      ),
    ).toBe(true);
  });

  test("serves documentation links by topic and the learned lessons file", async () => {
    const knowledgeBase = await loadKnowledgeBase(
      knowledgePath,
      new HashEmbeddings(),
    );

    expect(
      knowledgeBase.documentationLinksFor("security").length,
    ).toBeGreaterThan(0);
    expect(knowledgeBase.documentationLinksFor("no-such-topic")).toEqual([]);
    expect(knowledgeBase.learnedLessons()).toContain("## Lesson:");
  });

  test("serves the vendored ponytail code-writing skill", async () => {
    const knowledgeBase = await loadKnowledgeBase(
      knowledgePath,
      new HashEmbeddings(),
    );

    const codeWritingSkill = knowledgeBase.codeWritingSkill();

    expect(codeWritingSkill).toContain("# Ponytail");
    expect(codeWritingSkill).toContain("## The ladder");
    expect(codeWritingSkill).toContain("## When NOT to be lazy");
  });

  test("serves the review-critic validation skill", async () => {
    const knowledgeBase = await loadKnowledgeBase(
      knowledgePath,
      new HashEmbeddings(),
    );

    const reviewValidationSkill = knowledgeBase.reviewValidationSkill();

    expect(reviewValidationSkill).toContain("# Review Critic");
    expect(reviewValidationSkill).toContain("## False-positive taxonomy");
    expect(reviewValidationSkill).toContain("## The quality bar");
  });
});
