import { readFile } from "node:fs/promises";

import { buildFeedbackGraph } from "../feedback/graph";
import type { FeedbackInput } from "../feedback/types";
import { buildFeedbackDependencies } from "../wiring";

export const runFeedbackCommand = async (replyPath: string): Promise<void> => {
  const { comment, humanReply } = JSON.parse(
    await readFile(replyPath, "utf-8"),
  ) as FeedbackInput;

  const graph = buildFeedbackGraph(buildFeedbackDependencies());
  const finalState = await graph.invoke(
    { comment, humanReply },
    { runName: "review-feedback", tags: ["pr-review-agent", "feedback"] },
  );

  const { classification, improvementPrUrl } = finalState;
  console.log(`Reply classified as: ${classification?.type}`);
  if (improvementPrUrl) {
    console.log(
      `Lesson recorded — improvement PR proposal at ${improvementPrUrl}`,
    );
  } else {
    console.log("No knowledge-base change needed for this reply.");
  }
};
