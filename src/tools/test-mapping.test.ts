import { describe, expect, test } from "bun:test";

import type { DiffFile } from "../diff/types";
import { analyzeTestMapping } from "./test-mapping";

const fileWith = (
  path: string,
  addedLines: number,
  status: DiffFile["status"] = "modified",
): DiffFile => ({
  path,
  status,
  hunks: [
    {
      header: "@@ -1,1 +1,1 @@",
      lines: Array.from({ length: addedLines }, (_, index) => ({
        kind: "added" as const,
        content: `line ${index}`,
        newLineNumber: index + 1,
      })),
    },
  ],
});

describe("analyzeTestMapping", () => {
  test("pairs source files with test files touched in the same diff by basename", () => {
    const report = analyzeTestMapping([
      fileWith("src/lib/upload.ts", 12),
      fileWith("src/lib/upload.test.ts", 8),
      fileWith("src/services/pricing.ts", 20),
    ]);

    expect(report.sourceFiles).toEqual([
      {
        path: "src/lib/upload.ts",
        status: "modified",
        addedLines: 12,
        testTouched: true,
      },
      {
        path: "src/services/pricing.ts",
        status: "modified",
        addedLines: 20,
        testTouched: false,
      },
    ]);
    expect(report.testFilesChanged).toEqual(["src/lib/upload.test.ts"]);
  });

  test("ignores deleted files and non-code files", () => {
    const report = analyzeTestMapping([
      fileWith("src/lib/legacy.ts", 0, "deleted"),
      fileWith("README.md", 5),
      fileWith("docs/guide.md", 3),
    ]);

    expect(report.sourceFiles).toEqual([]);
  });

  test("recognises spec files and dedicated test directories", () => {
    const report = analyzeTestMapping([
      fileWith("src/parser.ts", 4),
      fileWith("tests/parser.spec.ts", 4),
    ]);

    expect(report.sourceFiles[0]!.testTouched).toBe(true);
  });
});
