import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredToolInterface } from "@langchain/core/tools";

import type { Ticket, TicketClient } from "./ticket";

const LINEAR_MCP_URL = "https://mcp.linear.app/mcp";

export type LinearTicketClientOptions = {
  /** Linear API key or OAuth access token — sent as a Bearer token. */
  apiKey: string;
  url?: string;
};

const parseTicket = (identifier: string, raw: string): Ticket | undefined => {
  try {
    const issue = JSON.parse(raw) as {
      identifier?: string;
      title?: string;
      description?: string;
    };
    if (!issue.title) return undefined;
    return {
      identifier: issue.identifier ?? identifier,
      title: issue.title,
      description: issue.description ?? "",
    };
  } catch {
    // Some MCP servers return prose rather than JSON — still useful context.
    return raw.trim()
      ? { identifier, title: identifier, description: raw.slice(0, 2000) }
      : undefined;
  }
};

/**
 * TicketClient backed by Linear's hosted MCP server, loaded through
 * LangChain's MCP adapter — the integration is configuration, not a
 * hand-written Linear API client. Any failure resolves to undefined: a
 * review must never fail because the ticket tracker is down.
 */
export const createLinearTicketClient = (
  options: LinearTicketClientOptions,
): TicketClient => {
  const client = new MultiServerMCPClient({
    mcpServers: {
      linear: {
        transport: "http",
        url: options.url ?? LINEAR_MCP_URL,
        headers: { Authorization: `Bearer ${options.apiKey}` },
      },
    },
  });
  let toolsPromise: Promise<StructuredToolInterface[]> | undefined;
  const loadTools = () => (toolsPromise ??= client.getTools());

  return async (identifier) => {
    try {
      const tools = await loadTools();
      const getIssue = tools.find((tool) => tool.name.endsWith("get_issue"));
      if (!getIssue) return undefined;
      const raw = await getIssue.invoke({ id: identifier });
      return parseTicket(identifier, String(raw));
    } catch (error) {
      console.warn(
        `  ⚠ could not fetch ticket ${identifier} from Linear: ${error instanceof Error ? error.message : error}`,
      );
      return undefined;
    }
  };
};
