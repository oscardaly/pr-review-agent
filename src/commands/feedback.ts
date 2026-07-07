import { readFile } from "node:fs/promises";

import { buildFeedbackGraph } from "../feedback/graph";
import type { FeedbackInput } from "../feedback/types";
import { buildFeedbackDependencies } from "../wiring";

export const runFeedbackCommand = async (replyPath: string): Promise<void> => {
  const { comment, humanReply, pr } = JSON.parse(
    await readFile(replyPath, "utf-8"),
  ) as FeedbackInput;

  const graph = buildFeedbackGraph(buildFeedbackDependencies());
  const finalState = await graph.invoke(
    { comment, humanReply, pr },
    { runName: "review-feedback", tags: ["pr-review-agent", "feedback"] },
  );

  const { classification, improvementPrUrl, updatedRegressionFile } =
    finalState;
  console.log(`Reply classified as: ${classification?.type}`);
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
