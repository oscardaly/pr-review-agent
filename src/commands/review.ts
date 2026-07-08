import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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
      return (
        `parsed ${update.pr?.files.length ?? 0} file(s), redacted ${update.redactions?.length ?? 0} secret/PII value(s)` +
        (update.ticket ? ` · linked ticket ${update.ticket.identifier}` : "")
      );
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
  const readInput = (path: string, flag: string): Promise<string> =>
    readFile(path, "utf-8").catch(() => {
      throw new Error(
        `Could not read ${path} — pass ${flag} <path>, or run \`make demo\` for the bundled sample PR.`,
      );
    });
  const [rawDiff, metadataJson] = await Promise.all([
    readInput(diffPath, "--diff"),
    readInput(metadataPath, "--pr"),
  ]);
  const metadata = JSON.parse(metadataJson) as PullRequestMetadata;

  const graph = buildReviewGraph(await buildReviewDependencies());
  // Caller-supplied so the run is addressable later: the feedback command
  // attaches the human verdict to this exact trace via createFeedback.
  const runId = randomUUID();
  const stream = await graph.stream(
    { rawDiff, metadata },
    {
      streamMode: "updates",
      runId,
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
  let reviewUrl: string | undefined;
  for await (const update of stream) {
    for (const [nodeName, nodeUpdate] of Object.entries(update)) {
      const stateUpdate = nodeUpdate as Partial<ReviewState>;
      reviewUrl = stateUpdate.reviewUrl ?? reviewUrl;
      console.log(
        `  ◆ ${nodeName.padEnd(22)} ${describeUpdate(nodeName, stateUpdate)}`,
      );
    }
  }
  // With the REST client the reviewUrl is a github.com link, not a directory.
  if (reviewUrl && !reviewUrl.startsWith("http")) {
    await writeFile(
      join(dirname(reviewUrl), "run.json"),
      JSON.stringify({ runId, prNumber: metadata.number }, null, 2),
    );
  }
  console.log(`\n${AGENT_NAME}'s review is ready.`);
  if (process.env.LANGSMITH_TRACING === "true") {
    console.log(
      `LangSmith run id: ${runId} — set "reviewRunId" in a feedback reply to attach the human verdict to this trace.`,
    );
  }
};
