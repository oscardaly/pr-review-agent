import { loadConfig, type AgentConfig } from "./config";
import { createChatModel, createEmbeddings } from "./models";
import { loadKnowledgeBase } from "./rag/knowledge-base";
import type { ReviewGraphDependencies } from "./review/dependencies";
import type { FeedbackGraphDependencies } from "./feedback/graph";
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

export const buildFeedbackDependencies = (
  config: AgentConfig = loadConfig(),
): FeedbackGraphDependencies => ({
  model: createChatModel(config),
  github: createFileSystemGithubClient(config.outputPath),
  knowledgePath: config.knowledgePath,
});
