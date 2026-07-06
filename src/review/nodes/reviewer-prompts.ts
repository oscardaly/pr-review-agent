import type { Document } from "@langchain/core/documents";

import { formatFilesForPrompt, summarizeFiles } from "../../diff/format-diff";
import type { PullRequest } from "../../diff/types";
import type { DocumentationLink } from "../../rag/knowledge-base";

const RETRIEVAL_QUERY_LIMIT = 2000;

/** Added code + file summary — the identifiers in added lines are what should match guideline text. */
export const retrievalQueryFor = (pr: PullRequest): string => {
  const addedCode = pr.files
    .flatMap((file) =>
      file.hunks.flatMap((hunk) =>
        hunk.lines.filter((line) => line.kind === "added"),
      ),
    )
    .map((line) => line.content)
    .join("\n");
  return `${summarizeFiles(pr.files)}\n${addedCode}`.slice(
    0,
    RETRIEVAL_QUERY_LIMIT,
  );
};

export const reviewerSystemPrompt = (label: string, focus: string): string =>
  [
    `You are the ${label} reviewer on a senior engineering team, reviewing one pull request.`,
    "",
    "Rules:",
    '- Comment ONLY on lines added in this diff (marked "+"). Never comment on removed or unchanged lines.',
    '- Ground every comment in one of the provided guideline sections and set "guideline" to that section\'s heading. If no guideline applies, do not invent a comment.',
    `- ${focus}`,
    "- Prefer few high-value comments over exhaustive nitpicks. An empty comments array is a fine answer.",
    "- Anchor each comment to the new-file line number shown in the left margin of the diff.",
    "- Include a documentation link in citations only when it genuinely supports the comment. Never fabricate URLs — use only links from the provided list.",
    "- severity: critical = correctness or security risk, warning = will cause maintenance pain, info = style preference.",
    "",
    "You are a mentor as much as a reviewer — every comment must teach:",
    '- In "body", explain WHY the change matters: name the underlying principle and the concrete consequence of leaving the code as-is. Never just dictate a change.',
    '- In "takeaway", give the transferable rule of thumb the author should carry to their next PR — generalise beyond this specific diff.',
    '- Any code you write in "suggestion" must follow the ponytail skill provided below: the laziest solution that works — reuse what the diff already has, stdlib before custom code, the shortest working diff — but never cut validation, error handling, or security.',
  ].join("\n");

export const formatGuidelines = (guidelines: Document[]): string =>
  guidelines
    .map(
      (guideline) =>
        `### ${guideline.metadata.source} — ${guideline.metadata.heading}\n${guideline.pageContent}`,
    )
    .join("\n\n");

export const formatDocumentationLinks = (links: DocumentationLink[]): string =>
  links.map((link) => `- ${link.title}: ${link.url}`).join("\n");

export const reviewerUserPrompt = (
  pr: PullRequest,
  guidelines: Document[],
  links: DocumentationLink[],
  codeWritingSkill: string,
): string =>
  [
    `Pull request #${pr.number} — ${pr.title}`,
    pr.description,
    "",
    "Team guidelines retrieved for this diff:",
    formatGuidelines(guidelines),
    "",
    "Documentation links you may cite:",
    formatDocumentationLinks(links),
    "",
    "Code-writing skill (governs any code you put in a suggestion):",
    codeWritingSkill || "(none installed)",
    "",
    "Diff (left margin shows new-file line numbers):",
    formatFilesForPrompt(pr.files),
  ].join("\n");
