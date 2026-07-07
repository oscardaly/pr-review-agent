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

const NATIVE_STRUCTURED_OUTPUT_MODELS = new WeakSet<BaseChatModel>();

/**
 * Opt a model into provider-native structured output. Called where real
 * providers are constructed (src/models.ts) — an explicit decision at the
 * composition root beats a capability heuristic, because test fakes inherit
 * a text-parsing withStructuredOutput from the base class that would
 * otherwise be picked up by accident.
 */
export const enableNativeStructuredOutput = <M extends BaseChatModel>(
  model: M,
): M => {
  NATIVE_STRUCTURED_OUTPUT_MODELS.add(model);
  return model;
};

const supportsNativeStructuredOutput = (model: BaseChatModel): boolean =>
  NATIVE_STRUCTURED_OUTPUT_MODELS.has(model);

const invokeWithNativeStructuredOutput = <T>(
  model: BaseChatModel,
  schema: z.ZodType<T>,
  systemPrompt: string,
  userPrompt: string,
  config?: RunnableConfig,
): Promise<T> =>
  model
    .withStructuredOutput(schema)
    .invoke(
      [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
      config,
    ) as Promise<T>;

const invokeWithPromptParsing = async <T>(
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

/**
 * Layered structured output: provider-native withStructuredOutput (the
 * docs-recommended path — json_schema mode by default, supported by the
 * OpenAI-compatible gateways too) whenever the model can bind tools, falling
 * back to prompt + Zod parse with one retry for models that can't — which is
 * exactly what keeps the scripted test fakes working unchanged.
 */
export const invokeStructured = <T>(
  model: BaseChatModel,
  schema: z.ZodType<T>,
  systemPrompt: string,
  userPrompt: string,
  config?: RunnableConfig,
): Promise<T> =>
  supportsNativeStructuredOutput(model)
    ? invokeWithNativeStructuredOutput(
        model,
        schema,
        systemPrompt,
        userPrompt,
        config,
      )
    : invokeWithPromptParsing(model, schema, systemPrompt, userPrompt, config);
