import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { AgentConfig } from "../config";
import type { KnowledgeBase } from "../rag/knowledge-base";
import type { GithubClient } from "../tools/github";
import type { SemgrepScanner } from "../tools/semgrep";

/**
 * Everything the graph touches from the outside world, injected at build time.
 * Tests swap the model for a scripted fake and the GitHub client for a spy —
 * the graph itself never knows.
 */
export type ReviewGraphDependencies = {
  model: BaseChatModel;
  knowledgeBase: KnowledgeBase;
  github: GithubClient;
  semgrepScanner: SemgrepScanner;
  config: AgentConfig;
};
