import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";

import type { PullRequestMetadata } from "../diff/types";
import { EVAL_DATASET } from "./dataset";
import {
  scoreExample,
  type EvalExpectation,
  type EvalOutputs,
} from "./evaluators";
import { buildEvalGraph, runExampleThroughGraph } from "./run-graph";

const DATASET_NAME = "pr-review-agent-evals";

const ensureDataset = async (client: Client): Promise<void> => {
  if (await client.hasDataset({ datasetName: DATASET_NAME })) return;
  const dataset = await client.createDataset(DATASET_NAME, {
    description:
      "PR diffs with expected review outcomes for the pr-review-agent",
  });
  await client.createExamples({
    datasetId: dataset.id,
    inputs: EVAL_DATASET.map((example) => ({
      diff: example.diff,
      metadata: example.metadata,
    })),
    outputs: EVAL_DATASET.map((example) => ({ ...example.expected })),
    metadata: EVAL_DATASET.map((example) => ({ name: example.name })),
  });
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

export const runOnLangSmith = async (): Promise<void> => {
  const client = new Client();
  await ensureDataset(client);
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
  });
  console.log(
    `Experiment complete — see the "${DATASET_NAME}" dataset in LangSmith.`,
  );
};
