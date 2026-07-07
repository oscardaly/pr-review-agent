import { readFile } from "node:fs/promises";

import { Client } from "langsmith";

import { buildFeedbackGraph } from "../feedback/graph";
import type { FeedbackClassification, FeedbackInput } from "../feedback/types";
import { buildFeedbackDependencies } from "../wiring";

/** Close the loop in LangSmith: the human verdict lands as feedback on the original review run. */
const attachVerdictToRun = async (
  reviewRunId: string,
  classification: FeedbackClassification,
  humanReply: string,
): Promise<void> => {
  try {
    await new Client().createFeedback(reviewRunId, "human-verdict", {
      score: classification.type === "rejection" ? 0 : 1,
      comment: humanReply,
    });
    console.log(
      "Human verdict attached to the original review run in LangSmith.",
    );
  } catch (error) {
    console.warn(
      `Could not attach LangSmith feedback to run ${reviewRunId}: ${error instanceof Error ? error.message : error}`,
    );
  }
};

export const runFeedbackCommand = async (replyPath: string): Promise<void> => {
  const replyJson = await readFile(replyPath, "utf-8").catch(() => {
    throw new Error(
      `Could not read ${replyPath} — pass --reply <path>, or run \`make feedback\` for the bundled sample reply.`,
    );
  });
  const { comment, humanReply, pr, reviewRunId } = JSON.parse(
    replyJson,
  ) as FeedbackInput;

  const graph = buildFeedbackGraph(buildFeedbackDependencies());
  const finalState = await graph.invoke(
    { comment, humanReply, pr },
    { runName: "review-feedback", tags: ["pr-review-agent", "feedback"] },
  );

  const { classification, improvementPrUrl, updatedRegressionFile } =
    finalState;
  console.log(`Reply classified as: ${classification?.type}`);
  if (reviewRunId && classification && process.env.LANGSMITH_API_KEY) {
    await attachVerdictToRun(reviewRunId, classification, humanReply);
  }
  if (improvementPrUrl) {
    console.log(
      `Lesson recorded — improvement PR proposal at ${improvementPrUrl}`,
    );
    if (updatedRegressionFile) {
      console.log(
        "The original diff is frozen as an eval regression case — `make eval` now guards against a repeat.",
      );
    }
  } else {
    console.log("No knowledge-base change needed for this reply.");
  }
};
