import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { summarizeFiles } from "../../diff/format-diff";
import { invokeStructured } from "../../structured";
import type { ReviewGraphDependencies } from "../dependencies";
import type { ReviewState, ReviewStateUpdate } from "../state";
import { DocsImpactSchema } from "../types";

const DOCUMENT_PREVIEW_LIMIT = 1500;

const DOCS_SYSTEM_PROMPT = [
  "You decide whether a pull request makes user-facing documentation stale.",
  "Flag a document only when the diff changes behaviour that the document describes",
  "(commands, endpoints, settings, visible flows). Internal refactors do not need doc updates.",
  "If nothing is stale, return needsUpdate: false with an empty items array.",
].join(" ");

const loadUserDocuments = async (
  userDocsPath: string,
): Promise<{ path: string; content: string }[]> => {
  try {
    const filenames = await readdir(userDocsPath);
    return await Promise.all(
      filenames
        .filter((filename) => filename.endsWith(".md"))
        .map(async (filename) => ({
          path: filename,
          content: (
            await readFile(join(userDocsPath, filename), "utf-8")
          ).slice(0, DOCUMENT_PREVIEW_LIMIT),
        })),
    );
  } catch {
    return [];
  }
};

export const makeDocsReviewer =
  (deps: ReviewGraphDependencies) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const documents = await loadUserDocuments(deps.config.userDocsPath);
    if (documents.length === 0) {
      return { docsImpact: { needsUpdate: false, items: [] } };
    }

    const userPrompt = [
      `Pull request #${state.pr.number} — ${state.pr.title}`,
      state.pr.description,
      "",
      "Changed files:",
      summarizeFiles(state.pr.files),
      "",
      "User-facing documentation:",
      ...documents.map(
        (document) => `--- ${document.path} ---\n${document.content}`,
      ),
    ].join("\n");

    const docsImpact = await invokeStructured(
      deps.model,
      DocsImpactSchema,
      DOCS_SYSTEM_PROMPT,
      userPrompt,
    );
    return { docsImpact };
  };
