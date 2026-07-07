import { z } from "zod";

import type { PullRequestMetadata } from "../diff/types";
import type { ReviewComment } from "../review/types";

export const FeedbackClassificationSchema = z.object({
  type: z
    .enum(["rejection", "agreement", "question"])
    .describe("rejection = the human says the comment was wrong or unwanted"),
  title: z
    .string()
    .describe(
      "Short kebab-case slug naming the lesson, e.g. idiomatic-short-lambdas",
    ),
  lesson: z
    .string()
    .describe(
      "Only for rejections: a generalized rule of thumb the reviewer should follow next time, derived from the human's reasoning — not just a restatement of this one case",
    ),
  regressionKeywords: z
    .array(z.string())
    .describe(
      "Only for rejections: 2-4 lowercase keywords identifying the rejected comment (from its category and title), used to detect the same mistake being repeated on the same diff",
    ),
});

export type FeedbackClassification = z.infer<
  typeof FeedbackClassificationSchema
>;

/** The PR the rejected comment was made on — enables a regression eval case. */
export type FeedbackPrContext = {
  metadata: PullRequestMetadata;
  diff: string;
};

export type FeedbackInput = {
  comment: ReviewComment;
  humanReply: string;
  pr?: FeedbackPrContext;
  /** LangSmith run id of the original review (printed by the review command) — links the verdict to the trace. */
  reviewRunId?: string;
};
