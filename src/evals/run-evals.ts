import { loadConfig } from "../config";
import { loadEvalDataset } from "./dataset";
import { scoreExample, type EvalScore } from "./evaluators";
import { buildEvalGraph, runExampleThroughGraph } from "./run-graph";
import { runOnLangSmith } from "./langsmith-runner";

const formatScores = (scores: EvalScore[]): string =>
  scores.map((score) => `${score.key}=${score.score.toFixed(2)}`).join("  ");

const runLocally = async (): Promise<void> => {
  console.log("LANGSMITH_API_KEY not set — running evals locally.\n");
  const dataset = await loadEvalDataset(loadConfig().knowledgePath);
  const graph = await buildEvalGraph();
  const allScores: EvalScore[] = [];

  for (const example of dataset) {
    const outputs = await runExampleThroughGraph(
      graph,
      { diff: example.diff, metadata: example.metadata },
      `eval:${example.name}`,
    );
    const scores = scoreExample(example.expected, outputs);
    allScores.push(...scores);
    console.log(`  ${example.name.padEnd(40)} ${formatScores(scores)}`);
  }

  const meanScore =
    allScores.reduce((sum, score) => sum + score.score, 0) / allScores.length;
  console.log(
    `\nMean score across ${dataset.length} examples: ${meanScore.toFixed(2)}`,
  );
};

// EVAL_LOCAL=1 forces the local runner even when a LangSmith key is set.
if (process.env.LANGSMITH_API_KEY && process.env.EVAL_LOCAL !== "1") {
  await runOnLangSmith();
} else {
  await runLocally();
}
