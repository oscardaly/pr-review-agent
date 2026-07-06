import { describe, expect, test } from "bun:test";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { z } from "zod";

import { invokeStructured } from "./structured";

const VerdictSchema = z.object({
  verdict: z.enum(["keep", "drop"]),
  confidence: z.number(),
});

describe("invokeStructured", () => {
  test("parses a plain JSON response", async () => {
    const model = new FakeListChatModel({
      responses: ['{"verdict":"keep","confidence":0.9}'],
    });

    const result = await invokeStructured(
      model,
      VerdictSchema,
      "system",
      "user",
    );

    expect(result).toEqual({ verdict: "keep", confidence: 0.9 });
  });

  test("parses JSON wrapped in a markdown fence", async () => {
    const model = new FakeListChatModel({
      responses: ['```json\n{"verdict":"drop","confidence":0.4}\n```'],
    });

    const result = await invokeStructured(
      model,
      VerdictSchema,
      "system",
      "user",
    );

    expect(result.verdict).toBe("drop");
  });

  test("retries once after an unparseable response", async () => {
    const model = new FakeListChatModel({
      responses: [
        "sorry, here is my analysis...",
        '{"verdict":"keep","confidence":0.7}',
      ],
    });

    const result = await invokeStructured(
      model,
      VerdictSchema,
      "system",
      "user",
    );

    expect(result.confidence).toBe(0.7);
  });

  test("throws with context when every attempt fails", async () => {
    const model = new FakeListChatModel({ responses: ["nope", "still nope"] });

    expect(
      invokeStructured(model, VerdictSchema, "system", "user"),
    ).rejects.toThrow("Failed to get valid structured output");
  });
});
