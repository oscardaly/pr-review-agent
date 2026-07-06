import { parseUnifiedDiff } from "../../diff/parse-diff";
import { redactPullRequestFiles } from "../../diff/redact";
import type { ReviewState, ReviewStateUpdate } from "../state";

/**
 * Guardrail boundary: parses the raw diff, redacts secrets/PII, and clears the
 * raw text from state — every later node (and trace) works on the redacted view.
 */
export const ingestNode = async (
  state: ReviewState,
): Promise<ReviewStateUpdate> => {
  const parsedFiles = parseUnifiedDiff(state.rawDiff);
  const { files, redactions } = redactPullRequestFiles(parsedFiles);
  return {
    pr: { ...state.metadata, files },
    redactions,
    rawDiff: "",
  };
};

export const hasReviewableChanges = (state: ReviewState): boolean =>
  state.pr.files.some((file) =>
    file.hunks.some((hunk) => hunk.lines.some((line) => line.kind === "added")),
  );
