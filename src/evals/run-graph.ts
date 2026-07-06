import { loadConfig } from "../config";
import { buildReviewGraph, type ReviewGraph } from "../review/graph";
import { buildReviewDependencies } from "../wiring";
import type { PullRequestMetadata } from "../diff/types";
import type { EvalOutputs } from "./evaluators";

/** Evals must not litter the output directory or "post" reviews — swallow publishes. */
const silentGithubClient = {
  postReview: async () => ({ url: "eval://not-published" }),
  openPullRequest: async () => ({ url: "eval://not-published" }),
};

export const buildEvalGraph = async (): Promise<ReviewGraph> => {
  const dependencies = await buildReviewDependencies(loadConfig());
  return buildReviewGraph({ ...dependencies, github: silentGithubClient });
};

export const runExampleThroughGraph = async (
  graph: ReviewGraph,
  input: { diff: string; metadata: PullRequestMetadata },
  runName: string,
): Promise<EvalOutputs> => {
  const finalState = await graph.invoke(
    { rawDiff: input.diff, metadata: input.metadata },
    { runName, tags: ["pr-review-agent", "eval"] },
  );
  return {
    findings: finalState.validatedComments.map(
      (comment) => `${comment.category} ${comment.title}`,
    ),
    severities: finalState.validatedComments.map((comment) => comment.severity),
    docsNeedUpdate: finalState.docsImpact?.needsUpdate ?? false,
  };
};
