import { loadConfig, type AgentConfig } from "./config";
import { createChatModel, createEmbeddings } from "./models";
import { loadKnowledgeBase } from "./rag/knowledge-base";
import type { ReviewGraphDependencies } from "./review/dependencies";
import type { FeedbackGraphDependencies } from "./feedback/graph";
import { createFileSystemGithubClient, type GithubClient } from "./tools/github";
import { createRestGithubClient } from "./tools/github-rest";
import { scanWithBuiltinRules } from "./tools/semgrep";

/** Reviews post to the real GitHub API when CI provides a token + repo (see .github/workflows/leo-review.yml). */
const createReviewGithubClient = (config: AgentConfig): GithubClient =>
  process.env.GITHUB_TOKEN && process.env.PR_AGENT_GITHUB_REPO
    ? createRestGithubClient({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.PR_AGENT_GITHUB_REPO,
      })
    : createFileSystemGithubClient(config.outputPath);

/** Composition root: the only place real implementations are chosen. */
export const buildReviewDependencies = async (
  config: AgentConfig = loadConfig(),
): Promise<ReviewGraphDependencies> => ({
  model: createChatModel(config),
  knowledgeBase: await loadKnowledgeBase(
    config.knowledgePath,
    createEmbeddings(config),
  ),
  github: createReviewGithubClient(config),
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
