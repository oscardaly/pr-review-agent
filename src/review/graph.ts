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
import { ReviewStateAnnotation, type ReviewState } from "./state";

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

export const buildReviewGraph = (deps: ReviewGraphDependencies) =>
  new StateGraph(ReviewStateAnnotation)
    .addNode("ingest", ingestNode)
    .addNode("style_reviewer", makeStyleReviewer(deps))
    .addNode("architecture_reviewer", makeArchitectureReviewer(deps))
    .addNode("security_reviewer", makeSecurityReviewer(deps))
    .addNode("tests_reviewer", makeTestsReviewer(deps))
    .addNode("docs_reviewer", makeDocsReviewer(deps))
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
