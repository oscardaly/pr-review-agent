import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { AgentConfig } from "../config";
import type { KnowledgeBase } from "../rag/knowledge-base";
import type { GithubClient } from "../tools/github";
import type { SemgrepScanner } from "../tools/semgrep";
import type { TicketClient } from "../tools/ticket";

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
  /** Optional: resolves ticket references (e.g. Linear over MCP) so reviewers see the PR's stated intent. */
  ticketClient?: TicketClient;
  config: AgentConfig;
};
