import { loadConfig, type AgentConfig } from "./config";
import { createChatModel, createEmbeddings } from "./models";
import { loadKnowledgeBase } from "./rag/knowledge-base";
import type { ReviewGraphDependencies } from "./review/dependencies";
import { createFileSystemGithubClient } from "./tools/github";
import { scanWithBuiltinRules } from "./tools/semgrep";

/** Composition root: the only place real implementations are chosen. */
export const buildReviewDependencies = async (
  config: AgentConfig = loadConfig(),
): Promise<ReviewGraphDependencies> => ({
  model: createChatModel(config),
  knowledgeBase: await loadKnowledgeBase(
    config.knowledgePath,
    createEmbeddings(config),
  ),
  github: createFileSystemGithubClient(config.outputPath),
  semgrepScanner: scanWithBuiltinRules,
  config,
});
