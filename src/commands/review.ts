import { readFile } from "node:fs/promises";

import type { PullRequestMetadata } from "../diff/types";
import { AGENT_NAME } from "../persona";
import { buildReviewGraph } from "../review/graph";
import type { ReviewState } from "../review/state";
import { buildReviewDependencies } from "../wiring";

const describeUpdate = (
  nodeName: string,
  update: Partial<ReviewState>,
): string => {
  switch (nodeName) {
    case "ingest":
      return `parsed ${update.pr?.files.length ?? 0} file(s), redacted ${update.redactions?.length ?? 0} secret/PII value(s)`;
    case "docs_reviewer":
      return update.docsImpact?.needsUpdate
        ? `${update.docsImpact.items.length} document(s) need updating`
        : "no documentation impact";
    case "validate_comments":
      return `kept ${update.validatedComments?.length ?? 0}, dropped ${update.droppedComments?.length ?? 0}`;
    case "publish_review":
      return `review written to ${update.reviewUrl}`;
    default:
      return `${update.draftComments?.length ?? 0} draft comment(s)`;
  }
};

export const runReviewCommand = async (
  diffPath: string,
  metadataPath: string,
): Promise<void> => {
  const [rawDiff, metadataJson] = await Promise.all([
    readFile(diffPath, "utf-8"),
    readFile(metadataPath, "utf-8"),
  ]);
  const metadata = JSON.parse(metadataJson) as PullRequestMetadata;

  const graph = buildReviewGraph(await buildReviewDependencies());
  const stream = await graph.stream(
    { rawDiff, metadata },
    {
      streamMode: "updates",
      runName: `pr-review #${metadata.number}`,
      tags: ["pr-review-agent"],
      metadata: {
        prNumber: metadata.number,
        repository: metadata.repository,
        author: metadata.author,
      },
    },
  );

  console.log(
    `${AGENT_NAME} is reviewing PR #${metadata.number}: ${metadata.title}\n`,
  );
  for await (const update of stream) {
    for (const [nodeName, nodeUpdate] of Object.entries(update)) {
      console.log(
        `  ◆ ${nodeName.padEnd(22)} ${describeUpdate(nodeName, nodeUpdate as Partial<ReviewState>)}`,
      );
    }
  }
  console.log(`\n${AGENT_NAME}'s review is ready.`);
};
