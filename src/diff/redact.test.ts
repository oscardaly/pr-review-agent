import { describe, expect, test } from "bun:test";

import { redactPullRequestFiles } from "./redact";
import type { DiffFile } from "./types";

const fileWithAddedLines = (lines: string[]): DiffFile => ({
  path: "src/example.ts",
  status: "modified",
  hunks: [
    {
      header: "",
      lines: lines.map((content, index) => ({
        kind: "added",
        content,
        newLineNumber: index + 1,
      })),
    },
  ],
});

const redactLines = (lines: string[]) =>
  redactPullRequestFiles([fileWithAddedLines(lines)]);

describe("redactPullRequestFiles", () => {
  test("replaces secrets and PII with typed placeholders", () => {
    const { files, redactions } = redactLines([
      'const key = "sk-live-8f2ab91cd0e34f5678a4b21c";',
      'sgMail.setApiKey("SG.x8kfj2n1qPzW9vLmT3RbDe.4nYw7cKq0sHtG5mXaJdV8pRfUu");',
      'const password = "hunter2-super-secret";',
      'const contact = "oscar@example.com";',
    ]);
    const contents = files[0]!.hunks[0]!.lines.map((line) => line.content);

    expect(contents[0]).toBe('const key = "[REDACTED:api-key]";');
    expect(contents[1]).toContain("[REDACTED:api-key]");
    expect(contents[2]).toBe("const password = [REDACTED:password];");
    expect(contents[3]).toBe('const contact = "[REDACTED:email]";');
    expect(redactions.map((redaction) => redaction.type)).toEqual([
      "api-key",
      "api-key",
      "password",
      "email",
    ]);
    expect(redactions[0]).toMatchObject({ file: "src/example.ts", line: 1 });
  });

  test("leaves ordinary code untouched", () => {
    const { files, redactions } = redactLines([
      "const total = prices.reduce((sum, price) => sum + price, 0);",
    ]);

    expect(files[0]!.hunks[0]!.lines[0]!.content).toBe(
      "const total = prices.reduce((sum, price) => sum + price, 0);",
    );
    expect(redactions).toEqual([]);
  });

  test("does not mistake numeric literals for phone numbers", () => {
    const { redactions } = redactLines([
      "const dimensions = [100, 200, 4000];",
      "retryDelays = [250, 500, 1000];",
    ]);

    expect(redactions).toEqual([]);
  });
});
