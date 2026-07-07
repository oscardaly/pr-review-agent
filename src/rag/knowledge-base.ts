import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";

import { chunkMarkdownByHeading } from "./chunk-markdown";
import { MemoryVectorStore } from "./memory-vector-store";

export type GuidelineTopic =
  | "style"
  | "clean-code"
  | "architecture"
  | "security";

export type DocumentationLink = {
  title: string;
  url: string;
  topics: string[];
};

export type KnowledgeBase = {
  retrieveGuidelines: (
    topics: GuidelineTopic[],
    query: string,
    k?: number,
  ) => Promise<Document[]>;
  documentationLinksFor: (topic: string) => DocumentationLink[];
  learnedLessons: () => string;
  codeWritingSkill: () => string;
  reviewValidationSkill: () => string;
};

const TOPIC_BY_FILENAME: Record<string, GuidelineTopic> = {
  "code-style.md": "style",
  "clean-code.md": "clean-code",
  "clean-architecture.md": "architecture",
  "owasp-top-10.md": "security",
  "owasp-llm-top-10.md": "security",
};

const DEFAULT_RETRIEVAL_COUNT = 4;

const loadGuidelineChunks = async (
  knowledgePath: string,
): Promise<Document[]> => {
  const filenames = await readdir(knowledgePath);
  const chunksPerFile = await Promise.all(
    filenames
      .filter((filename) => TOPIC_BY_FILENAME[filename])
      .map(async (filename) => {
        const markdown = await readFile(join(knowledgePath, filename), "utf-8");
        return chunkMarkdownByHeading(markdown, {
          source: filename,
          topic: TOPIC_BY_FILENAME[filename]!,
        });
      }),
  );
  return chunksPerFile.flat();
};

const loadDocumentationLinks = async (
  knowledgePath: string,
): Promise<DocumentationLink[]> => {
  const raw = await readFile(join(knowledgePath, "doc-links.json"), "utf-8");
  return JSON.parse(raw) as DocumentationLink[];
};

const loadLearnedLessons = async (knowledgePath: string): Promise<string> => {
  try {
    return await readFile(
      join(knowledgePath, "learned", "rejected-comments.md"),
      "utf-8",
    );
  } catch {
    return "";
  }
};

const loadSkill = async (
  knowledgePath: string,
  filename: string,
): Promise<string> => {
  try {
    return await readFile(join(knowledgePath, "skills", filename), "utf-8");
  } catch {
    return "";
  }
};

export const loadKnowledgeBase = async (
  knowledgePath: string,
  embeddings: Embeddings,
): Promise<KnowledgeBase> => {
  const [chunks, documentationLinks, lessons, codeWritingSkill, reviewCritic] =
    await Promise.all([
      loadGuidelineChunks(knowledgePath),
      loadDocumentationLinks(knowledgePath),
      loadLearnedLessons(knowledgePath),
      // Vendored from https://github.com/DietrichGebert/ponytail (MIT) — governs suggestion code.
      loadSkill(knowledgePath, "ponytail.md"),
      loadSkill(knowledgePath, "review-critic.md"),
    ]);
  const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  return {
    retrieveGuidelines: (topics, query, k = DEFAULT_RETRIEVAL_COUNT) =>
      vectorStore.similaritySearch(query, k, (document) =>
        topics.includes(document.metadata.topic),
      ),
    documentationLinksFor: (topic) =>
      documentationLinks.filter((link) => link.topics.includes(topic)),
    learnedLessons: () => lessons,
    codeWritingSkill: () => codeWritingSkill,
    reviewValidationSkill: () => reviewCritic,
  };
};
