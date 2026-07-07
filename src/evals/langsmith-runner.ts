import { execSync } from "node:child_process";

import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";

import { loadConfig } from "../config";
import type { PullRequestMetadata } from "../diff/types";
import { loadEvalDataset, type EvalExample } from "./dataset";
import {
  scoreExample,
  type EvalExpectation,
  type EvalOutputs,
} from "./evaluators";
import { buildEvalGraph, runExampleThroughGraph } from "./run-graph";

const DATASET_NAME = "pr-review-agent-evals";

/**
 * Idempotent append, not create-once: regression cases recorded by the
 * feedback graph after the dataset first exists must still reach LangSmith,
 * or "the dataset grows itself" would only be true locally.
 */
const syncDataset = async (
  client: Client,
  examples: EvalExample[],
): Promise<void> => {
  const dataset = (await client.hasDataset({ datasetName: DATASET_NAME }))
    ? await client.readDataset({ datasetName: DATASET_NAME })
    : await client.createDataset(DATASET_NAME, {
        description:
          "PR diffs with expected review outcomes for the pr-review-agent",
      });

  const existingNames = new Set<string>();
  for await (const example of client.listExamples({ datasetId: dataset.id })) {
    existingNames.add(String(example.metadata?.name ?? ""));
  }

  const newExamples = examples.filter(
    (example) => !existingNames.has(example.name),
  );
  if (newExamples.length === 0) return;
  await client.createExamples(
    newExamples.map((example) => ({
      dataset_id: dataset.id,
      inputs: { diff: example.diff, metadata: example.metadata },
      outputs: { ...example.expected },
      metadata: { name: example.name },
    })),
  );
};

type KeyValueMap = Record<string, unknown>;

const scoreEvaluator = (args: {
  outputs?: KeyValueMap;
  referenceOutputs?: KeyValueMap;
}) =>
  scoreExample(
    args.referenceOutputs as EvalExpectation,
    args.outputs as unknown as EvalOutputs,
  );

/** Experiments become comparable over time when stamped with what produced them. */
const currentGitCommit = (): string | undefined => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7);
  }
};

export const runOnLangSmith = async (): Promise<void> => {
  const config = loadConfig();
  const client = new Client();
  await syncDataset(client, await loadEvalDataset(config.knowledgePath));
  const graph = await buildEvalGraph();

  const reviewTarget = async (inputs: KeyValueMap): Promise<KeyValueMap> =>
    runExampleThroughGraph(
      graph,
      inputs as { diff: string; metadata: PullRequestMetadata },
      "eval-run",
    );

  await evaluate(reviewTarget, {
    data: DATASET_NAME,
    client,
    experimentPrefix: "pr-review-agent",
    evaluators: [scoreEvaluator],
    metadata: { model: config.model, commit: currentGitCommit() ?? "unknown" },
  });
  console.log(
    `Experiment complete — see the "${DATASET_NAME}" dataset in LangSmith.`,
  );
};
