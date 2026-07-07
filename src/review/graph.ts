import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph";

import type { ReviewGraphDependencies } from "./dependencies";
import { hasReviewableChanges, ingestNode } from "./nodes/ingest";
import { makeDocsReviewer } from "./nodes/docs-reviewer";
import {
  makeArchitectureReviewer,
  makeStyleReviewer,
} from "./nodes/guideline-reviewers";
import { makeReviewPublisher } from "./nodes/publish-review";
import { makeSecurityReviewer } from "./nodes/security-reviewer";
import { makeTestsReviewer } from "./nodes/tests-reviewer";
import { makeCommentValidator } from "./nodes/validate-comments";
import {
  ReviewStateSchema,
  type ReviewState,
  type ReviewStateUpdate,
} from "./state";

const REVIEWERS = [
  "style_reviewer",
  "architecture_reviewer",
  "security_reviewer",
  "tests_reviewer",
  "docs_reviewer",
] as const;

/** Decision point: an empty or delete-only diff skips the reviewers entirely. */
const routeAfterIngest = (state: ReviewState) =>
  hasReviewableChanges(state) ? [...REVIEWERS] : "publish_review";

type ReviewerNode = (
  state: ReviewState,
  config?: RunnableConfig,
) => Promise<ReviewStateUpdate>;

/**
 * One reviewer dying degrades that perspective, not the whole review. The
 * catch lives INSIDE the node (not in an errorHandler option) on purpose:
 * handler nodes run under their own name, which would break the
 * [...REVIEWERS] → validate_comments barrier. Transient provider errors are
 * already retried by the chat-model clients' built-in maxRetries.
 */
const degradeOnFailure =
  (reviewer: string, node: ReviewerNode): ReviewerNode =>
  async (state, config) => {
    try {
      return await node(state, config);
    } catch (error) {
      console.warn(
        `  ⚠ ${reviewer} failed and was skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { draftComments: [] };
    }
  };

export const buildReviewGraph = (deps: ReviewGraphDependencies) =>
  new StateGraph(ReviewStateSchema)
    // Applies to the non-reviewer nodes: reviewers catch their own failures below.
    .setNodeDefaults({ retryPolicy: { maxAttempts: 3 } })
    .addNode("ingest", ingestNode)
    .addNode(
      "style_reviewer",
      degradeOnFailure("style_reviewer", makeStyleReviewer(deps)),
    )
    .addNode(
      "architecture_reviewer",
      degradeOnFailure("architecture_reviewer", makeArchitectureReviewer(deps)),
    )
    .addNode(
      "security_reviewer",
      degradeOnFailure("security_reviewer", makeSecurityReviewer(deps)),
    )
    .addNode(
      "tests_reviewer",
      degradeOnFailure("tests_reviewer", makeTestsReviewer(deps)),
    )
    .addNode(
      "docs_reviewer",
      degradeOnFailure("docs_reviewer", makeDocsReviewer(deps)),
    )
    .addNode("validate_comments", makeCommentValidator(deps))
    .addNode("publish_review", makeReviewPublisher(deps))
    .addEdge(START, "ingest")
    .addConditionalEdges("ingest", routeAfterIngest, [
      ...REVIEWERS,
      "publish_review",
    ])
    .addEdge([...REVIEWERS], "validate_comments")
    .addEdge("validate_comments", "publish_review")
    .addEdge("publish_review", END)
    .compile();

export type ReviewGraph = ReturnType<typeof buildReviewGraph>;
