import { Annotation } from "@langchain/langgraph";

import type { Redaction } from "../diff/redact";
import type { PullRequest, PullRequestMetadata } from "../diff/types";
import type { DocsImpact, ReviewComment, ValidatedComment } from "./types";

const appendComments = (
  existing: ReviewComment[],
  incoming: ReviewComment[],
): ReviewComment[] => existing.concat(incoming);

const lastWriteWins = <T>(_previous: T, next: T): T => next;
const emptyList = <T>() => ({
  reducer: lastWriteWins<T[]>,
  default: (): T[] => [],
});

export const ReviewStateAnnotation = Annotation.Root({
  /** Raw inputs; ingest clears rawDiff after redaction so secrets don't linger in state. */
  rawDiff: Annotation<string>,
  metadata: Annotation<PullRequestMetadata>,

  /** Parsed, redacted pull request — the only view of the code downstream nodes see. */
  pr: Annotation<PullRequest>,
  redactions: Annotation<Redaction[]>(emptyList<Redaction>()),

  /** Reviewers run in parallel and each append their draft comments. */
  draftComments: Annotation<ReviewComment[]>({
    reducer: appendComments,
    default: () => [],
  }),
  docsImpact: Annotation<DocsImpact | undefined>,

  /** Validator subagent output. */
  validatedComments:
    Annotation<ValidatedComment[]>(emptyList<ValidatedComment>()),
  droppedComments:
    Annotation<ValidatedComment[]>(emptyList<ValidatedComment>()),

  reviewUrl: Annotation<string | undefined>,
});

export type ReviewState = typeof ReviewStateAnnotation.State;
export type ReviewStateUpdate = typeof ReviewStateAnnotation.Update;
