import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Embeddings } from "@langchain/core/embeddings";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import type { AgentConfig } from "./config";
import { HashEmbeddings } from "./rag/hash-embeddings";

const NO_PROVIDER_MESSAGE = [
  "No model provider configured.",
  "Set OPENAI_API_KEY (optionally OPENAI_BASE_URL to point at Vercel AI Gateway or any",
  "OpenAI-compatible endpoint) or ANTHROPIC_API_KEY. See .env.example.",
].join(" ");

export const createChatModel = (config: AgentConfig): BaseChatModel => {
  if (config.openaiApiKey) {
    return new ChatOpenAI({
      model: config.model,
      apiKey: config.openaiApiKey,
      temperature: 0,
      configuration: config.openaiBaseUrl
        ? { baseURL: config.openaiBaseUrl }
        : undefined,
    });
  }
  if (config.anthropicApiKey) {
    return new ChatAnthropic({
      model: config.model,
      apiKey: config.anthropicApiKey,
      temperature: 0,
    });
  }
  throw new Error(NO_PROVIDER_MESSAGE);
};

export const createEmbeddings = (config: AgentConfig): Embeddings => {
  if (config.openaiApiKey && !config.openaiBaseUrl) {
    return new OpenAIEmbeddings({ apiKey: config.openaiApiKey });
  }
  return new HashEmbeddings();
};
