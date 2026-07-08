import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod";

import type { Redaction } from "../diff/redact";
import type { PullRequest, PullRequestMetadata } from "../diff/types";
import type { Ticket } from "../tools/ticket";
import {
  DocsImpactSchema,
  ReviewCommentSchema,
  ValidatedCommentSchema,
  type ReviewComment,
} from "./types";

export const ReviewStateSchema = new StateSchema({
  /** Raw inputs; ingest clears rawDiff after redaction so secrets don't linger in state. */
  rawDiff: z.string(),
  metadata: z.custom<PullRequestMetadata>(),

  /** Parsed, redacted pull request — the only view of the code downstream nodes see. */
  pr: z.custom<PullRequest>(),
  redactions: z.custom<Redaction[]>().default(() => []),

  /** The Linear ticket the PR references, when a ticket client is wired and the fetch succeeds. */
  ticket: z.custom<Ticket>().optional(),

  /** Reviewers run in parallel and each append their draft comments — the graph's only merged channel. */
  draftComments: new ReducedValue(
    z.array(ReviewCommentSchema).default(() => []),
    {
      reducer: (existing: ReviewComment[], incoming: ReviewComment[]) =>
        existing.concat(incoming),
    },
  ),
  docsImpact: DocsImpactSchema.optional(),

  /** Validator subagent output. */
  validatedComments: z.array(ValidatedCommentSchema).default(() => []),
  droppedComments: z.array(ValidatedCommentSchema).default(() => []),

  reviewUrl: z.string().optional(),
});

export type ReviewState = typeof ReviewStateSchema.State;
export type ReviewStateUpdate = typeof ReviewStateSchema.Update;
