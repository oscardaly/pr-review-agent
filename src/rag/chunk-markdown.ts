import { Document } from "@langchain/core/documents";

/**
 * Splits a markdown guideline document on `##` headings so each retrievable
 * chunk is one complete rule — a semantic boundary a token-count splitter
 * would happily cut through.
 */
export const chunkMarkdownByHeading = (
  markdown: string,
  metadata: Record<string, string>,
): Document[] => {
  const sections = markdown
    .split(/^(?=## )/m)
    .filter((section) => section.trim().length > 0);
  return sections.map((section) => {
    const heading =
      section.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? "introduction";
    return new Document({
      pageContent: section.trim(),
      metadata: { ...metadata, heading },
    });
  });
};
