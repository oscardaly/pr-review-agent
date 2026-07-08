import { parseUnifiedDiff } from "../../diff/parse-diff";
import { redactPullRequestFiles } from "../../diff/redact";
import { extractTicketIdentifier } from "../../tools/ticket";
import type { ReviewGraphDependencies } from "../dependencies";
import type { ReviewState, ReviewStateUpdate } from "../state";

/**
 * Guardrail boundary: parses the raw diff, redacts secrets/PII, and clears the
 * raw text from state — every later node (and trace) works on the redacted
 * view. Also resolves the referenced ticket (when a ticket client is wired)
 * so reviewers can judge the diff against its stated intent.
 */
export const makeIngestNode =
  (deps: Pick<ReviewGraphDependencies, "ticketClient">) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const parsedFiles = parseUnifiedDiff(state.rawDiff);
    const { files, redactions } = redactPullRequestFiles(parsedFiles);
    const identifier = extractTicketIdentifier(
      `${state.metadata.title}\n${state.metadata.description}`,
    );
    const ticket =
      identifier && deps.ticketClient
        ? await deps.ticketClient(identifier)
        : undefined;
    return {
      pr: { ...state.metadata, files },
      redactions,
      ticket,
      rawDiff: "",
    };
  };

export const hasReviewableChanges = (state: ReviewState): boolean =>
  state.pr.files.some((file) =>
    file.hunks.some((hunk) => hunk.lines.some((line) => line.kind === "added")),
  );
