import { parseArgs } from "node:util";

import { runFeedbackCommand } from "./commands/feedback";
import { runReviewCommand } from "./commands/review";

const USAGE = `pr-review-agent

Usage:
  bun src/cli.ts review   [--diff <path>] [--pr <path>]    Review a pull request diff
  bun src/cli.ts feedback [--reply <path>]                 Process a human reply to a review comment
`;

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    diff: { type: "string", default: "fixtures/sample-pr.diff" },
    pr: { type: "string", default: "fixtures/sample-pr.json" },
    reply: { type: "string", default: "fixtures/sample-reply.json" },
  },
});

const command = positionals[0];

const dispatchCommand = async (): Promise<void> => {
  switch (command) {
    case "review":
      return runReviewCommand(values.diff, values.pr);
    case "feedback":
      return runFeedbackCommand(values.reply);
    default:
      console.log(USAGE);
      process.exit(command ? 1 : 0);
  }
};

try {
  await dispatchCommand();
} catch (error) {
  console.error(`\nError: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
