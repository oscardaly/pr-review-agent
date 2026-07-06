import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { parseUnifiedDiff } from "./parse-diff";

const SAMPLE_DIFF = readFileSync(
  new URL("../../fixtures/sample-pr.diff", import.meta.url),
  "utf-8",
);

describe("parseUnifiedDiff", () => {
  test("parses every file in the fixture diff with its status", () => {
    const files = parseUnifiedDiff(SAMPLE_DIFF);

    expect(files.map((file) => file.path)).toEqual([
      "src/app/api/export/route.ts",
      "src/lib/exportHelpers.ts",
      "src/cli/flags.ts",
    ]);
    expect(files.map((file) => file.status)).toEqual([
      "added",
      "added",
      "modified",
    ]);
  });

  test("tracks new-file line numbers through added and removed lines", () => {
    const diff = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -10,4 +10,4 @@ export const example = () => {",
      " const first = 1;",
      "-const second = 2;",
      "+const secondValue = 2;",
      " const third = 3;",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    const lines = file!.hunks[0]!.lines;

    expect(lines[0]).toMatchObject({
      kind: "context",
      oldLineNumber: 10,
      newLineNumber: 10,
    });
    expect(lines[1]).toMatchObject({
      kind: "removed",
      content: "const second = 2;",
      oldLineNumber: 11,
    });
    expect(lines[2]).toMatchObject({
      kind: "added",
      content: "const secondValue = 2;",
      newLineNumber: 11,
    });
    expect(lines[3]).toMatchObject({
      kind: "context",
      oldLineNumber: 12,
      newLineNumber: 12,
    });
    expect(file!.hunks[0]!.header).toBe("export const example = () => {");
  });

  test("returns an empty list for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});
