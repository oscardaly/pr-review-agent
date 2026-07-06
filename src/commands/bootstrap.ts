import { bootstrapKnowledge } from "../bootstrap";
import { loadConfig } from "../config";
import { createChatModel } from "../models";

export const runBootstrapCommand = async (repoPath: string): Promise<void> => {
  const config = loadConfig();
  console.log(`Drafting guideline docs from ${repoPath} ...`);
  const writtenFiles = await bootstrapKnowledge(
    repoPath,
    config.knowledgePath,
    createChatModel(config),
  );
  for (const file of writtenFiles) {
    console.log(`  ✎ ${file}`);
  }
  console.log(
    "\nReview and edit these before trusting them — the agent drafted them, the team owns them.",
  );
};
