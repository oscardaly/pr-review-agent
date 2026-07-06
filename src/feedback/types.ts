import { z } from "zod";

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
});

export type FeedbackClassification = z.infer<
  typeof FeedbackClassificationSchema
>;

export type FeedbackInput = {
  comment: ReviewComment;
  humanReply: string;
};
