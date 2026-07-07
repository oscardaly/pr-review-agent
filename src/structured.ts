import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";

const MAX_PARSE_ATTEMPTS = 2;

const formatInstructions = (schema: z.ZodType): string =>
  [
    "Respond with a single JSON object and nothing else — no prose, no markdown fence.",
    "The JSON must match this JSON Schema:",
    JSON.stringify(z.toJSONSchema(schema)),
  ].join("\n");

const stripCodeFence = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced?.[1] ?? text).trim();
};

const parseResponse = <T>(schema: z.ZodType<T>, raw: string): T =>
  schema.parse(JSON.parse(stripCodeFence(raw)));

/**
 * Prompt-based structured output: works identically across real providers and
 * the fake chat models used in tests, at the cost of one retry on bad JSON.
 * (Provider-native tool-calling would be more robust but is not fakeable.)
 */
export const invokeStructured = async <T>(
  model: BaseChatModel,
  schema: z.ZodType<T>,
  systemPrompt: string,
  userPrompt: string,
  config?: RunnableConfig,
): Promise<T> => {
  const messages: BaseMessage[] = [
    new SystemMessage(`${systemPrompt}\n\n${formatInstructions(schema)}`),
    new HumanMessage(userPrompt),
  ];
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt += 1) {
    const response = await model.invoke(messages, config);
    try {
      return parseResponse(schema, String(response.content));
    } catch (error) {
      lastError = error;
      messages.push(response);
      messages.push(
        new HumanMessage(
          `Your previous response failed to parse (${error}). Reply again with only the corrected JSON object.`,
        ),
      );
    }
  }
  throw new Error(
    `Failed to get valid structured output after ${MAX_PARSE_ATTEMPTS} attempts: ${lastError}`,
  );
};
