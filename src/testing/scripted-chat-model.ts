import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";

export type ScriptRule = {
  /** Substring that must appear somewhere in the prompt for this rule to fire. */
  match: string;
  /** Object responses are JSON-stringified — pair with invokeStructured schemas. */
  response: unknown;
};

/**
 * Test double that answers by matching prompt content instead of call order,
 * so tests stay deterministic when graph nodes run in parallel.
 */
export class ScriptedChatModel extends BaseChatModel {
  constructor(private readonly rules: ScriptRule[]) {
    super({});
  }

  _llmType(): string {
    return "scripted";
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const promptText = messages
      .map((message) => String(message.content))
      .join("\n");
    const rule = this.rules.find((candidate) =>
      promptText.includes(candidate.match),
    );
    if (!rule) {
      throw new Error(
        `ScriptedChatModel: no rule matches prompt starting "${promptText.slice(0, 120)}..."`,
      );
    }
    const text =
      typeof rule.response === "string"
        ? rule.response
        : JSON.stringify(rule.response);
    return { generations: [{ text, message: new AIMessage(text) }] };
  }
}
