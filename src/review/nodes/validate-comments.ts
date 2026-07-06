import { formatFileForPrompt } from "../../diff/format-diff";
import { invokeStructured } from "../../structured";
import type { ReviewGraphDependencies } from "../dependencies";
import type { ReviewState, ReviewStateUpdate } from "../state";
import {
  ValidationVerdictSchema,
  type ReviewComment,
  type ValidatedComment,
} from "../types";

const VALIDATOR_SYSTEM_PROMPT = [
  "You are a skeptical staff engineer validating a single draft review comment before it is posted.",
  "Drop the comment if: it refers to a line that was not added in the diff, it misreads the code,",
  "the guideline does not actually support it, it duplicates what the code already does,",
  "it dictates a change without explaining why it matters, its takeaway teaches the author nothing reusable,",
  "or it repeats a mistake from the 'previously rejected comments' lessons below.",
  "Keep it only if a senior engineer would find it worth acting on and learn something from.",
  "Confidence is YOUR confidence in the verdict, from 0 to 1.",
].join(" ");

const deduplicationKeyOf = (comment: ReviewComment): string =>
  `${comment.file}:${comment.line ?? "-"}:${comment.category}`;

const deduplicate = (comments: ReviewComment[]): ReviewComment[] => {
  const seen = new Set<string>();
  return comments.filter((comment) => {
    const key = deduplicationKeyOf(comment);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const judgeComment = async (
  comment: ReviewComment,
  state: ReviewState,
  deps: ReviewGraphDependencies,
): Promise<ValidatedComment> => {
  const file = state.pr.files.find(
    (changedFile) => changedFile.path === comment.file,
  );
  const userPrompt = [
    "Draft comment:",
    JSON.stringify(comment, null, 2),
    "",
    "The diff it refers to:",
    file
      ? formatFileForPrompt(file)
      : "(file not found in this diff — that alone is grounds to drop)",
    "",
    "Previously rejected comments (do not approve anything repeating these mistakes):",
    deps.knowledgeBase.learnedLessons() || "(none recorded yet)",
  ].join("\n");

  const validation = await invokeStructured(
    deps.model,
    ValidationVerdictSchema,
    VALIDATOR_SYSTEM_PROMPT,
    userPrompt,
  );
  return { ...comment, validation };
};

/** Subagent pass: every draft comment is independently cross-examined before publishing. */
export const makeCommentValidator =
  (deps: ReviewGraphDependencies) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const uniqueComments = deduplicate(state.draftComments);
    const judged = await Promise.all(
      uniqueComments.map((comment) => judgeComment(comment, state, deps)),
    );

    const isPublishable = (comment: ValidatedComment): boolean =>
      comment.validation.verdict === "keep" &&
      comment.validation.confidence >=
        deps.config.validationConfidenceThreshold;

    return {
      validatedComments: judged.filter(isPublishable),
      droppedComments: judged.filter((comment) => !isPublishable(comment)),
    };
  };
