import { describe, expect, test } from "bun:test";

import { loadConfig } from "./config";

describe("loadConfig", () => {
  test("defaults the model to match the configured provider", () => {
    expect(loadConfig({ OPENAI_API_KEY: "sk-x" }).model).toBe("gpt-4o-mini");
    expect(loadConfig({ ANTHROPIC_API_KEY: "sk-ant-x" }).model).toBe(
      "claude-sonnet-4-5",
    );
    expect(
      loadConfig({ ANTHROPIC_API_KEY: "sk-ant-x", PR_AGENT_MODEL: "claude-opus-4-1" })
        .model,
    ).toBe("claude-opus-4-1");
  });

  test("rejects a validation threshold that is not a number in [0, 1]", () => {
    expect(() =>
      loadConfig({ PR_AGENT_VALIDATION_THRESHOLD: "high" }),
    ).toThrow("must be a number between 0 and 1");
    expect(() =>
      loadConfig({ PR_AGENT_VALIDATION_THRESHOLD: "2" }),
    ).toThrow("must be a number between 0 and 1");
    expect(
      loadConfig({ PR_AGENT_VALIDATION_THRESHOLD: "0.8" })
        .validationConfidenceThreshold,
    ).toBe(0.8);
  });
});
